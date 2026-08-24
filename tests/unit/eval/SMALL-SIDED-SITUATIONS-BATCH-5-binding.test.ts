/**
 * @module tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-5-binding.test.ts
 *
 * Evidence-binding test: proves that the consolidated batch-5 evidence
 * (`docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-5/situations/`) is byte-identical
 * to fresh evaluator runs on the source fixtures that produced each situation's
 * PASS verdict.
 *
 * BATCH-5 consolidates 8/8 PASS from 3 fixtures:
 * - PASS_RECEPTION, SUPPORT_AND_PASSING_LANES, SETTLED_ATTACK_VS_DEFENCE,
 *   ATTACK_TO_DEFENCE_TRANSITION, DEFENCE_TO_ATTACK_TRANSITION, COORDINATED_PRESS
 *   ← from `3v3-situation-driven-extended.v1.json` (BATCH-4 base)
 * - SHOT_TO_RESULT ← from `3v3-situation-driven-shot-resolution.v1.json`
 * - PHYSICAL_DUEL ← from `3v3-situation-driven-duel-rejection.v1.json`
 *
 * Verifies:
 *  1. All eight situation artifacts and index.json exist in batch-5.
 *  2. Each artifact's verdict is PASS and consistent with index.json.
 *  3. Each artifact's `source_fixture` field matches the expected fixture.
 *  4. Fresh evaluator runs on each source fixture produce byte-identical
 *     per-situation artifacts (determinism + honesty).
 *  5. Consolidated verdict is 8/8 PASS.
 *  6. Index.json metadata reflects consolidated run.
 *  7. Per-situation PASS is attributed to its real source fixture.
 *
 * Node I/O is allowed.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import {
  runSituationEvaluator,
  type SituationEvidenceArtifact,
} from "../../../eval/runners/small-sided-situation-evaluator.js";
import { MAPPED_SITUATION_IDS } from "../../../eval/contracts/situation-mapping.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_5_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-5/situations",
);

/** All 8 situations covered by batch-5 */
const BATCH_5_TARGETS = [
  "PASS_RECEPTION",
  "SHOT_TO_RESULT",
  "PHYSICAL_DUEL",
  "SUPPORT_AND_PASSING_LANES",
  "SETTLED_ATTACK_VS_DEFENCE",
  "ATTACK_TO_DEFENCE_TRANSITION",
  "DEFENCE_TO_ATTACK_TRANSITION",
  "COORDINATED_PRESS",
];

/**
 * Source fixture mapping per situation: which fixture produces this situation's PASS.
 */
const SOURCE_FIXTURES: Record<string, string> = {
  PASS_RECEPTION: "3v3-situation-driven-extended.v1.json",
  SHOT_TO_RESULT: "3v3-situation-driven-shot-resolution.v1.json",
  PHYSICAL_DUEL: "3v3-situation-driven-duel-rejection.v1.json",
  SUPPORT_AND_PASSING_LANES: "3v3-situation-driven-extended.v1.json",
  SETTLED_ATTACK_VS_DEFENCE: "3v3-situation-driven-extended.v1.json",
  ATTACK_TO_DEFENCE_TRANSITION: "3v3-situation-driven-extended.v1.json",
  DEFENCE_TO_ATTACK_TRANSITION: "3v3-situation-driven-extended.v1.json",
  COORDINATED_PRESS: "3v3-situation-driven-extended.v1.json",
};

/** All situations that share a source fixture — grouped for efficient fresh runs */
const FIXTURE_SITUATION_MAP: Record<string, string[]> = {};
for (const [sitId, fixture] of Object.entries(SOURCE_FIXTURES)) {
  if (!FIXTURE_SITUATION_MAP[fixture]) FIXTURE_SITUATION_MAP[fixture] = [];
  FIXTURE_SITUATION_MAP[fixture].push(sitId);
}

// ---------------------------------------------------------------------------
// Temp dirs for re-run comparison (one per unique source fixture)
// ---------------------------------------------------------------------------

let tmpDirs: Record<string, string> = {};

beforeAll(() => {
  tmpDirs = {};
  for (const fixture of Object.keys(FIXTURE_SITUATION_MAP)) {
    const safeName = fixture.replace(/[^a-z0-9]/g, "-");
    tmpDirs[fixture] = join("/tmp", `batch5-${safeName}-${Date.now()}`);
    mkdirSync(tmpDirs[fixture], { recursive: true });
  }
});

afterAll(() => {
  for (const [, dir] of Object.entries(tmpDirs)) {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

// ---------------------------------------------------------------------------
// 1. Persisted artifacts exist and match index.json
// ---------------------------------------------------------------------------

describe("BATCH-5 binding: persisted artifacts exist", () => {
  it("index.json exists in batch-5 dir", () => {
    expect(existsSync(join(BATCH_5_DIR, "index.json"))).toBe(true);
  });

  it("all eight target situation artifacts exist", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_5_DIR, "index.json"), "utf-8"),
    );
    const sitIds = new Set(
      index.situations.map((s: { situation_id: string }) => s.situation_id),
    );

    for (const target of BATCH_5_TARGETS) {
      expect(
        existsSync(join(BATCH_5_DIR, `${target}.json`)),
        `Missing artifact for ${target}`,
      ).toBe(true);
      expect(sitIds.has(target), `${target} should be in index`).toBe(true);
    }
  });

  it("each target artifact's verdict matches the index", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_5_DIR, "index.json"), "utf-8"),
    );

    for (const target of BATCH_5_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_5_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      const indexEntry = index.situations.find(
        (s: { situation_id: string }) => s.situation_id === target,
      );

      expect(indexEntry).toBeDefined();
      expect(artifact.verdict).toBe(indexEntry!.verdict);
      expect(artifact.relevant_events.length).toBe(indexEntry!.relevant_event_count);
    }
  });

  it("index.json reports 8/8 PASS", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_5_DIR, "index.json"), "utf-8"),
    );

    expect(index.passRate).toBe("8/8");
    expect(index.passCount).toBe(8);
    expect(index.situationCount).toBe(8);
  });

  it("index reflects consolidated fixture count", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_5_DIR, "index.json"), "utf-8"),
    );

    expect(index.sources).toBeDefined();
    expect(index.sources.length).toBe(3);
    const fixtureNames = index.sources.map((s: { fixture: string }) => s.fixture);
    expect(fixtureNames).toContain("3v3-situation-driven-extended.v1.json");
    expect(fixtureNames).toContain("3v3-situation-driven-shot-resolution.v1.json");
    expect(fixtureNames).toContain("3v3-situation-driven-duel-rejection.v1.json");
  });
});

// ---------------------------------------------------------------------------
// 2. Honest verdicts: all 8 PASS
// ---------------------------------------------------------------------------

describe("BATCH-5 binding: honest verdicts", () => {
  it("all eight situations are PASS", () => {
    for (const target of BATCH_5_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_5_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      expect(
        artifact.verdict,
        `Verdict for ${target} should be PASS`,
      ).toBe("PASS");
    }
  });

  it("all artifacts have relevant events (no NOT_EVALUATED)", () => {
    for (const target of BATCH_5_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_5_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      expect(
        artifact.relevant_events.length,
        `${target} should have relevant events (not NOT_EVALUATED)`,
      ).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. source_fixture provenance fields
// ---------------------------------------------------------------------------

describe("BATCH-5 binding: source_fixture provenance", () => {
  it("each artifact's source_fixture matches expected fixture", () => {
    for (const target of BATCH_5_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_5_DIR, `${target}.json`), "utf-8"),
      ) as Record<string, unknown> & { source_fixture?: string };

      expect(artifact.source_fixture).toBeDefined();
      expect(artifact.source_fixture).toBe(
        SOURCE_FIXTURES[target],
        `${target} should be sourced from ${SOURCE_FIXTURES[target]}`,
      );
    }
  });

  it("index.json source_fixture matches artifact source_fixture", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_5_DIR, "index.json"), "utf-8"),
    );

    for (const entry of index.situations as {
      situation_id: string;
      source_fixture: string;
    }[]) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_5_DIR, `${entry.situation_id}.json`), "utf-8"),
      ) as Record<string, unknown> & { source_fixture?: string };

      expect(artifact.source_fixture).toBe(entry.source_fixture);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Byte-identical re-run per source fixture
// ---------------------------------------------------------------------------

describe("BATCH-5 binding: byte-identical re-run per fixture", () => {
  /** Run fresh evaluator on a fixture and compare per-situation artifacts */
  function compareFixtureRun(fixtureName: string, expectedSits: string[]) {
    const tmpDir = tmpDirs[fixtureName];

    const result = runSituationEvaluator(fixtureName, tmpDir);

    for (const sitId of expectedSits) {
      // Batch-5 artifacts include an extra `source_fixture` field.
      // Compare the "core" artifact content (everything except source_fixture)
      // to prove byte-identical evaluator output.
      const batch5Raw = readFileSync(
        join(BATCH_5_DIR, `${sitId}.json`),
        "utf-8",
      );
      const batch5Obj = JSON.parse(batch5Raw) as Record<string, unknown>;
      const { source_fixture: _, ...batch5Core } = batch5Obj;

      const freshContent = readFileSync(
        join(tmpDir, `${sitId}.json`),
        "utf-8",
      );
      const freshObj = JSON.parse(freshContent) as Record<string, unknown>;
      const freshCore = JSON.parse(
        JSON.stringify(freshObj),
      ) as Record<string, unknown>;

      expect(
        JSON.stringify(batch5Core),
        `Artifact ${sitId} from ${fixtureName} must be byte-identical to batch-5 (core content)`,
      ).toBe(JSON.stringify(freshCore));

      // Also verify the fresh run artifact matches the batch-5 artifact shape
      const freshArtifact = JSON.parse(freshContent) as SituationEvidenceArtifact;
      expect(freshArtifact.situation_id).toBe(sitId);
      expect(freshArtifact.verdict).toBe("PASS");
    }

    // Also verify trajectory hashes match
    for (const sitId of expectedSits) {
      const batch5Raw = readFileSync(
        join(BATCH_5_DIR, `${sitId}.json`),
        "utf-8",
      );
      const batch5Artifact = JSON.parse(batch5Raw) as SituationEvidenceArtifact;
      const freshContent = readFileSync(
        join(tmpDir, `${sitId}.json`),
        "utf-8",
      );
      const freshArtifact = JSON.parse(freshContent) as SituationEvidenceArtifact;

      expect(freshArtifact.trajectory.map((t) => t.hash)).toEqual(
        batch5Artifact.trajectory.map((t) => t.hash),
      );
    }
  }

  it("extended fixture produces byte-identical artifacts for its 6 situations", () => {
    const extendedSits = FIXTURE_SITUATION_MAP["3v3-situation-driven-extended.v1.json"]!;
    compareFixtureRun("3v3-situation-driven-extended.v1.json", extendedSits);
  });

  it("shot-resolution fixture produces byte-identical artifact for SHOT_TO_RESULT", () => {
    const shotSits = FIXTURE_SITUATION_MAP["3v3-situation-driven-shot-resolution.v1.json"]!;
    compareFixtureRun("3v3-situation-driven-shot-resolution.v1.json", shotSits);
  });

  it("duel-rejection fixture produces byte-identical artifact for PHYSICAL_DUEL", () => {
    const duelSits = FIXTURE_SITUATION_MAP["3v3-situation-driven-duel-rejection.v1.json"]!;
    compareFixtureRun("3v3-situation-driven-duel-rejection.v1.json", duelSits);
  });
});

// ---------------------------------------------------------------------------
// 5. Consolidated verdict is 8/8 PASS
// ---------------------------------------------------------------------------

describe("BATCH-5 binding: consolidated verdict", () => {
  it("index reports 8 PASS situations", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_5_DIR, "index.json"), "utf-8"),
    );

    const passCount = index.situations.filter(
      (s: { verdict: string }) => s.verdict === "PASS",
    ).length;
    expect(passCount).toBe(8);
  });

  it("each PASS situation is attributed to its real source fixture", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_5_DIR, "index.json"), "utf-8"),
    );

    for (const entry of index.situations as {
      situation_id: string;
      verdict: string;
      source_fixture: string;
    }[]) {
      expect(entry.verdict).toBe("PASS");
      expect(entry.source_fixture).toBe(
        SOURCE_FIXTURES[entry.situation_id],
        `${entry.situation_id} should be attributed to ${SOURCE_FIXTURES[entry.situation_id]}`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 6. index.json metadata correctness
// ---------------------------------------------------------------------------

describe("BATCH-5 binding: index metadata", () => {
  it("index reflects consolidated run metadata", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_5_DIR, "index.json"), "utf-8"),
    );

    expect(index.objective_id).toBe("SMALL-SIDED-SITUATIONS-BATCH-5");
    expect(index.totalTicks).toBe(60);
    expect(index.seed).toBe(42);
    expect(typeof index.finalStateHash).toBe("string");
    expect(index.finalStateHash).toMatch(/^fnv1a64-v1:/);
  });

  it("all 8 mapped situations appear in index", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_5_DIR, "index.json"), "utf-8"),
    );

    const indexSitIds = new Set(
      index.situations.map((s: { situation_id: string }) => s.situation_id),
    );
    for (const id of MAPPED_SITUATION_IDS) {
      expect(indexSitIds.has(id), `Missing situation ${id} in index`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Artifact shape validation
// ---------------------------------------------------------------------------

describe("BATCH-5 binding: artifact shape", () => {
  it("all artifacts have required top-level fields", () => {
    const requiredFields = [
      "situation_id",
      "evidence_requirement",
      "verdict",
      "verdict_reason",
      "relevant_events",
      "relevant_observations",
      "team_geometry",
      "all_events",
      "all_observations",
      "trajectory",
      "has_invariant_failures",
      "total_ticks",
      "scenario_id",
      "source_fixture",
    ];

    for (const target of BATCH_5_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_5_DIR, `${target}.json`), "utf-8"),
      ) as Record<string, unknown>;

      for (const field of requiredFields) {
        expect(artifact[field], `${field} missing from ${target}`).toBeDefined();
      }
    }
  });

  it("trajectory entries have tick, hash, players, ball fields", () => {
    for (const target of BATCH_5_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_5_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      expect(artifact.trajectory.length).toBeGreaterThan(0);
      const firstEntry = artifact.trajectory[0];
      expect(typeof firstEntry.tick).toBe("number");
      expect(typeof firstEntry.hash).toBe("string");
      expect(Array.isArray(firstEntry.players)).toBe(true);
      expect(firstEntry.players.length).toBe(6);
      expect(typeof firstEntry.ball.position.x).toBe("number");
      expect(typeof firstEntry.ball.position.y).toBe("number");
      expect(typeof firstEntry.ball.position.z).toBe("number");
      expect(typeof firstEntry.ball.regime).toBe("string");
    }
  });

  it("team_geometry entries have player positions", () => {
    for (const target of BATCH_5_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_5_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      expect(artifact.team_geometry.length).toBe(artifact.total_ticks);
      const firstGeom = artifact.team_geometry[0];
      expect(firstGeom.players.length).toBe(6);
      for (const p of firstGeom.players) {
        expect(typeof p.playerId).toBe("string");
        expect(typeof p.teamId).toBe("string");
        expect(typeof p.position.x).toBe("number");
        expect(typeof p.position.y).toBe("number");
      }
    }
  });
});