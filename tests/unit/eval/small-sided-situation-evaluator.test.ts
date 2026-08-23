/**
 * @module tests/unit/eval/small-sided-situation-evaluator.test.ts
 *
 * Unit tests for the small-sided situation evaluator runner.
 *
 * Verifies:
 *  1. Determinism: two runs of the same fixture produce identical artifacts.
 *  2. NaN/throw-free execution for both fixtures.
 *  3. Per-situation artifact creation for all 8 situations.
 *  4. Honest NOT_EVALUATED when no relevant events exist.
 *  5. Mapping association correctness: each artifact maps to its situation.
 *  6. Injectable output directory (temp dir isolation).
 *  7. Trajectory data present and well-formed.
 *  8. Summary index written.
 *
 * Node I/O is allowed in tests.
 */

import { readFileSync, rmSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest";

import {
  runSituationEvaluator,
  computeSituationVerdict,
  type SituationEvidenceArtifact,
  type SituationEvaluatorResult,
} from "../../../eval/runners/small-sided-situation-evaluator.js";
import {
  MAPPED_SITUATION_IDS,
  SITUATION_EVIDENCE_REQUIREMENTS,
  getSituationEvidence,
  isRelevantEvent,
} from "../../../eval/contracts/situation-mapping.js";

// ---------------------------------------------------------------------------
// Temp dir helper
// ---------------------------------------------------------------------------

const TEST_OUTPUT_PREFIX = "/tmp/situation-evaluator-test-";
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
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_NAMES = [
  "3v3-situation-fixture.v1.json",
  "3v3-transition-fixture.v1.json",
];

// ---------------------------------------------------------------------------
// 1. Determinism: two runs produce identical artifacts
// ---------------------------------------------------------------------------

describe("Situation evaluator: determinism", () => {
  for (const fixture of FIXTURE_NAMES) {
    describe(fixture, () => {
      let tmpDir1: string;
      let tmpDir2: string;

      beforeAll(() => {
        tmpDir1 = makeTempDir();
        tmpDir2 = makeTempDir();
      });

      afterAll(() => {
        cleanupTempDir(tmpDir1);
        cleanupTempDir(tmpDir2);
      });

      it("two runs produce identical situation artifacts", () => {
        const result1 = runSituationEvaluator(fixture, tmpDir1);
        const result2 = runSituationEvaluator(fixture, tmpDir2);

        // Compare the result objects (excluding timestamps that may differ).
        // Both fixtures should have the same number of situations.
        expect(result1.situationArtifacts.length).toBe(result2.situationArtifacts.length);

        // Compare each artifact.
        for (let i = 0; i < result1.situationArtifacts.length; i++) {
          const a1 = result1.situationArtifacts[i];
          const a2 = result2.situationArtifacts[i];

          // Same situation IDs.
          expect(a1.situation_id).toBe(a2.situation_id);

          // Same verdict.
          expect(a1.verdict).toBe(a2.verdict);

          // Same relevant events count and content.
          expect(a1.relevant_events.length).toBe(a2.relevant_events.length);
          expect(JSON.stringify(a1.relevant_events)).toBe(JSON.stringify(a2.relevant_events));

          // Same trajectory length.
          expect(a1.trajectory.length).toBe(a2.trajectory.length);

          // Same team geometry length.
          expect(a1.team_geometry.length).toBe(a2.team_geometry.length);

          // Same total ticks.
          expect(a1.total_ticks).toBe(a2.total_ticks);
        }

        // Same summary index.
        const index1 = JSON.parse(readFileSync(join(tmpDir1, "index.json"), "utf-8"));
        const index2 = JSON.parse(readFileSync(join(tmpDir2, "index.json"), "utf-8"));
        expect(index1.situationCount).toBe(index2.situationCount);
        expect(index1.totalTicks).toBe(index2.totalTicks);
      });

      it("two runs produce identical output files", () => {
        const tmpDir1b = makeTempDir();
        const tmpDir2b = makeTempDir();

        runSituationEvaluator(fixture, tmpDir1b);
        runSituationEvaluator(fixture, tmpDir2b);

        // Compare each situation artifact file.
        for (const sitId of MAPPED_SITUATION_IDS) {
          const f1 = join(tmpDir1b, `${sitId}.json`);
          const f2 = join(tmpDir2b, `${sitId}.json`);

          if (existsSync(f1)) {
            expect(existsSync(f2)).toBe(true);
            expect(readFileSync(f1, "utf-8")).toBe(readFileSync(f2, "utf-8"));
          }
        }

        cleanupTempDir(tmpDir1b);
        cleanupTempDir(tmpDir2b);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// 2. NaN/throw-free execution
// ---------------------------------------------------------------------------

describe("Situation evaluator: robustness", () => {
  for (const fixture of FIXTURE_NAMES) {
    describe(fixture, () => {
      it("runs without throwing", () => {
        const tmpDir = makeTempDir();
        expect(() => runSituationEvaluator(fixture, tmpDir)).not.toThrow();
        cleanupTempDir(tmpDir);
      });

      it("all trajectory positions are finite", () => {
        const tmpDir = makeTempDir();
        const result = runSituationEvaluator(fixture, tmpDir);
        for (const artifact of result.situationArtifacts) {
          for (const entry of artifact.trajectory) {
            expect(Number.isFinite(entry.ball.position.x)).toBe(true);
            expect(Number.isFinite(entry.ball.position.y)).toBe(true);
            expect(Number.isFinite(entry.ball.position.z)).toBe(true);
            for (const p of entry.players) {
              expect(Number.isFinite(p.position.x)).toBe(true);
              expect(Number.isFinite(p.position.y)).toBe(true);
            }
          }
        }
        cleanupTempDir(tmpDir);
      });

      it("all state hashes are non-empty strings", () => {
        const tmpDir = makeTempDir();
        const result = runSituationEvaluator(fixture, tmpDir);
        expect(typeof result.finalStateHash).toBe("string");
        expect(result.finalStateHash.length).toBeGreaterThan(0);
        cleanupTempDir(tmpDir);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// 3. Per-situation artifact creation
// ---------------------------------------------------------------------------

describe("Situation evaluator: artifact creation", () => {
  it("creates an artifact for every mapped situation", () => {
    const tmpDir = makeTempDir();
    const result = runSituationEvaluator("3v3-situation-fixture.v1.json", tmpDir);

    const artifactIds = new Set(result.situationArtifacts.map((a) => a.situation_id));
    for (const sitId of MAPPED_SITUATION_IDS) {
      expect(artifactIds.has(sitId), `Missing artifact for ${sitId}`).toBe(true);
    }

    cleanupTempDir(tmpDir);
  });

  it("writes artifact files to disk", () => {
    const tmpDir = makeTempDir();
    runSituationEvaluator("3v3-situation-fixture.v1.json", tmpDir);

    for (const sitId of MAPPED_SITUATION_IDS) {
      const filePath = join(tmpDir, `${sitId}.json`);
      expect(existsSync(filePath), `File not written: ${filePath}`).toBe(true);

      // Verify it's valid JSON with required fields.
      const raw = readFileSync(filePath, "utf-8");
      const artifact = JSON.parse(raw) as Record<string, unknown>;
      expect(artifact.situation_id).toBeDefined();
      expect(["PASS", "FAIL", "NOT_EVALUATED"]).toContain(artifact.verdict);
      expect(Array.isArray(artifact.relevant_events)).toBe(true);
      expect(Array.isArray(artifact.team_geometry)).toBe(true);
      expect(Array.isArray(artifact.trajectory)).toBe(true);
    }

    cleanupTempDir(tmpDir);
  });

  it("writes index.json summary", () => {
    const tmpDir = makeTempDir();
    runSituationEvaluator("3v3-situation-fixture.v1.json", tmpDir);

    const indexPath = join(tmpDir, "index.json");
    expect(existsSync(indexPath)).toBe(true);

    const index = JSON.parse(readFileSync(indexPath, "utf-8")) as Record<string, unknown>;
    expect(index.fixtureName).toBe("3v3-situation-fixture.v1.json");
    expect(typeof index.scenarioId).toBe("string");
    expect(typeof index.totalTicks).toBe("number");
    expect(typeof index.seed).toBe("number");
    expect(typeof index.situationCount).toBe("number");
    expect(Array.isArray(index.situations)).toBe(true);
    expect(index.situationCount).toBe(index.situations.length);

    cleanupTempDir(tmpDir);
  });
});

// ---------------------------------------------------------------------------
// 4. Honest NOT_EVALUATED when no relevant events
// ---------------------------------------------------------------------------

describe("Situation evaluator: verdict rules", () => {
  it("NOT_EVALUATED when no relevant events", () => {
    // Create a mock situation with a required event kind that won't appear.
    const fakeEvent = {
      id: "scheduler",
      tick: 0,
      sequence: 0,
      kind: "scheduler",
      label: "scheduler tick",
      payload: {},
    } as any;

    // Use a non-mapped situation ID (or just simulate NOT_EVALUATED manually).
    // The verdict computation is independent: if we pass zero relevant events,
    // we should get NOT_EVALUATED.
    const req = {
      situation_id: "TEST_SITUATION",
      required_event_kinds: ["pass"],
      indicative_event_kinds: ["shot"],
      requires_position_data: true,
      requires_team_geometry: true,
      mapping_status: "READY",
      evidence_chain: "test chain",
    };

    const { verdict, reason } = computeSituationVerdict("TEST_SITUATION", [], req);
    expect(verdict).toBe("NOT_EVALUATED");
    expect(reason).toContain("No relevant events");
  });

  it("PASS when required events appear and indicative also present", () => {
    const req = {
      situation_id: "PASS_RECEPTION",
      required_event_kinds: ["pass", "player-ball-contact"],
      indicative_event_kinds: ["second-touch"],
      requires_position_data: true,
      requires_team_geometry: false,
      mapping_status: "READY",
      evidence_chain: "test",
    };

    const events = [
      { id: "e1", tick: 10, sequence: 0, kind: "pass", label: "pass", payload: {} } as any,
      { id: "e2", tick: 11, sequence: 0, kind: "player-ball-contact", label: "touch", payload: {} } as any,
      { id: "e3", tick: 12, sequence: 0, kind: "second-touch", label: "second", payload: {} } as any,
    ];

    const { verdict } = computeSituationVerdict("PASS_RECEPTION", events, req);
    expect(verdict).toBe("PASS");
  });

  it("FAIL when required present but indicative absent", () => {
    const req = {
      situation_id: "PASS_RECEPTION",
      required_event_kinds: ["pass", "player-ball-contact"],
      indicative_event_kinds: ["second-touch"],
      requires_position_data: true,
      requires_team_geometry: false,
      mapping_status: "READY",
      evidence_chain: "test",
    };

    const events = [
      { id: "e1", tick: 10, sequence: 0, kind: "pass", label: "pass", payload: {} } as any,
      { id: "e2", tick: 11, sequence: 0, kind: "player-ball-contact", label: "touch", payload: {} } as any,
    ];

    const { verdict } = computeSituationVerdict("PASS_RECEPTION", events, req);
    expect(verdict).toBe("FAIL");
  });

  it("PASS when required present and no indicative defined", () => {
    const req = {
      situation_id: "TEST",
      required_event_kinds: ["pass"],
      indicative_event_kinds: [],
      requires_position_data: true,
      requires_team_geometry: false,
      mapping_status: "READY",
      evidence_chain: "test",
    };

    const events = [
      { id: "e1", tick: 10, sequence: 0, kind: "pass", label: "pass", payload: {} } as any,
    ];

    const { verdict } = computeSituationVerdict("TEST", events, req);
    expect(verdict).toBe("PASS");
  });

  it("NOT_EVALUATED when no required event kinds match", () => {
    const req = {
      situation_id: "PHYSICAL_DUEL",
      required_event_kinds: ["player-player-contact"],
      indicative_event_kinds: ["input-rejection"],
      requires_position_data: true,
      requires_team_geometry: false,
      mapping_status: "READY",
      evidence_chain: "test",
    };

    const events = [
      { id: "e1", tick: 10, sequence: 0, kind: "pass", label: "pass", payload: {} } as any,
    ];

    const { verdict } = computeSituationVerdict("PHYSICAL_DUEL", events, req);
    expect(verdict).toBe("NOT_EVALUATED");
  });
});

// ---------------------------------------------------------------------------
// 5. Mapping association correctness
// ---------------------------------------------------------------------------

describe("Situation evaluator: mapping association", () => {
  it("each artifact references the correct evidence requirement", () => {
    const tmpDir = makeTempDir();
    const result = runSituationEvaluator("3v3-situation-fixture.v1.json", tmpDir);

    for (const artifact of result.situationArtifacts) {
      const mappedReq = getSituationEvidence(artifact.situation_id);
      expect(mappedReq).toBeDefined();
      expect(artifact.evidence_requirement.situation_id).toBe(artifact.situation_id);
      expect(artifact.evidence_requirement.situation_id).toBe(mappedReq!.situation_id);
    }

    cleanupTempDir(tmpDir);
  });

  it("artifact situation_ids match MAPPED_SITUATION_IDS", () => {
    const tmpDir = makeTempDir();
    const result = runSituationEvaluator("3v3-situation-fixture.v1.json", tmpDir);

    const artifactIds = new Set(result.situationArtifacts.map((a) => a.situation_id));
    const mappedIds = new Set(MAPPED_SITUATION_IDS);

    expect(artifactIds.size).toBe(mappedIds.size);
    for (const id of mappedIds) {
      expect(artifactIds.has(id)).toBe(true);
    }

    cleanupTempDir(tmpDir);
  });

  it("fixture-specific situations are subset of all mapped situations", () => {
    const tmpDir = makeTempDir();

    const result = runSituationEvaluator("3v3-situation-fixture.v1.json", tmpDir);
    const artifactIds = new Set(result.situationArtifacts.map((a) => a.situation_id));

    // The situation fixture should only contain situations it covers.
    // Transition fixture should contain its own.
    // All must be subsets of the mapped set.
    for (const id of artifactIds) {
      expect(MAPPED_SITUATION_IDS.includes(id)).toBe(true);
    }

    cleanupTempDir(tmpDir);
  });
});

// ---------------------------------------------------------------------------
// 6. Injectability: output dir isolation
// ---------------------------------------------------------------------------

describe("Situation evaluator: injectable output directory", () => {
  it("writes to the provided directory", () => {
    const tmpDir = makeTempDir();
    runSituationEvaluator("3v3-situation-fixture.v1.json", tmpDir);

    // Check index.json exists in the temp dir.
    const indexPath = join(tmpDir, "index.json");
    expect(existsSync(indexPath)).toBe(true);

    // Verify fixture name in index.
    const index = JSON.parse(readFileSync(indexPath, "utf-8"));
    expect(index.fixtureName).toBe("3v3-situation-fixture.v1.json");

    cleanupTempDir(tmpDir);
  });

  it("different fixtures produce different artifacts in same dir", () => {
    const tmpDir = makeTempDir();

    runSituationEvaluator("3v3-situation-fixture.v1.json", tmpDir);
    runSituationEvaluator("3v3-transition-fixture.v1.json", tmpDir);

    // Both fixtures should have written their situation files.
    // Situation fixture has 5 situations, transition has 3.
    // Together all 8 should have files.
    const fileNames = new Set(
      readdirSync(tmpDir).filter((f: string) => f.endsWith(".json")),
    );

    // Should have 8 situation artifacts + 1 index = 9 files
    expect(fileNames.size).toBe(9);

    cleanupTempDir(tmpDir);
  });
});

// ---------------------------------------------------------------------------
// 7. Trajectory data
// ---------------------------------------------------------------------------

describe("Situation evaluator: trajectory data", () => {
  it("trajectory contains tick entries matching observations", () => {
    const tmpDir = makeTempDir();
    const result = runSituationEvaluator("3v3-situation-fixture.v1.json", tmpDir);

    const artifact = result.situationArtifacts[0];
    expect(artifact.trajectory.length).toBeGreaterThan(0);
    // First observation tick is 1 (after first step), last is totalTicks.
    const firstTick = artifact.trajectory[0].tick;
    const lastTick = artifact.trajectory[artifact.trajectory.length - 1].tick;
    expect(firstTick).toBeLessThan(lastTick);
    expect(lastTick).toBe(result.totalTicks);

    cleanupTempDir(tmpDir);
  });

  it("trajectory entries have required fields", () => {
    const tmpDir = makeTempDir();
    const result = runSituationEvaluator("3v3-situation-fixture.v1.json", tmpDir);

    const artifact = result.situationArtifacts[0];
    for (const entry of artifact.trajectory.slice(0, 5)) {
      expect(typeof entry.tick).toBe("number");
      expect(typeof entry.hash).toBe("string");
      expect(entry.hash).toMatch(/fnv1a64-v1:/);
      expect(Array.isArray(entry.players)).toBe(true);
      expect(entry.players.length).toBe(6);
      for (const p of entry.players) {
        expect(typeof p.playerId).toBe("string");
        expect(typeof p.teamId).toBe("string");
        expect(typeof p.position.x).toBe("number");
        expect(typeof p.position.y).toBe("number");
      }
      expect(typeof entry.ball.position.x).toBe("number");
      expect(typeof entry.ball.position.y).toBe("number");
      expect(typeof entry.ball.position.z).toBe("number");
      expect(typeof entry.ball.regime).toBe("string");
    }

    cleanupTempDir(tmpDir);
  });
});

// ---------------------------------------------------------------------------
// 8. Team geometry extraction
// ---------------------------------------------------------------------------

describe("Situation evaluator: team geometry", () => {
  it("team geometry has entries for every tick", () => {
    const tmpDir = makeTempDir();
    const result = runSituationEvaluator("3v3-situation-fixture.v1.json", tmpDir);

    const artifact = result.situationArtifacts[0];
    // All 8 situations share the same team geometry (from the full run).
    expect(artifact.team_geometry.length).toBe(result.totalTicks);

    cleanupTempDir(tmpDir);
  });
});

// ---------------------------------------------------------------------------
// 9. Mapping helper: isRelevantEvent consistency
// ---------------------------------------------------------------------------

describe("Situation evaluator: filter consistency", () => {
  it("isRelevantEvent for all 8 situations returns consistent results", () => {
    const passEvent = { id: "e1", tick: 0, sequence: 0, kind: "pass", label: "pass", payload: {} } as any;
    const shotEvent = { id: "e2", tick: 0, sequence: 0, kind: "shot", label: "shot", payload: {} } as any;
    const contactEvent = { id: "e3", tick: 0, sequence: 0, kind: "player-player-contact", label: "contact", payload: {} } as any;
    const ballOutEvent = { id: "e4", tick: 0, sequence: 0, kind: "ball-out-of-play", label: "out", payload: {} } as any;
    const goalEvent = { id: "e5", tick: 0, sequence: 0, kind: "goal", label: "goal", payload: {} } as any;
    const pbContactEvent = { id: "e6", tick: 0, sequence: 0, kind: "player-ball-contact", label: "pb-contact", payload: {} } as any;
    const inputRejectEvent = { id: "e7", tick: 0, sequence: 0, kind: "input-rejection", label: "reject", payload: {} } as any;

    const events: any[] = [
      passEvent, shotEvent, contactEvent, ballOutEvent, goalEvent, pbContactEvent, inputRejectEvent,
    ];

    for (const sitId of MAPPED_SITUATION_IDS) {
      const req = getSituationEvidence(sitId);
      expect(req).toBeDefined();

      const relevant = events.filter((e) => isRelevantEvent(e, sitId));
      // All relevant events must have a kind that matches at least one required or indicative.
      for (const e of relevant) {
        const kindMatchesRequired = req!.required_event_kinds.includes(e.kind);
        const kindMatchesIndicative = req!.indicative_event_kinds.includes(e.kind);
        expect(kindMatchesRequired || kindMatchesIndicative,
          `Event kind "${e.kind}" should match required or indicative for ${sitId}`,
        ).toBe(true);
      }
    }
  });
});