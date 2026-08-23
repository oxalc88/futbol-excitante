/**
 * @module tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-1-binding.test.ts
 *
 * Evidence-binding test: proves that the persisted batch-1 evidence
 * (`docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-1/situations/`) matches
 * a fresh evaluator run (live honesty).
 *
 * Verifies:
 *  1. All four target situation artifacts exist in batch-1.
 *  2. Each artifact's verdict and relevant_event_count match the index.
 *  3. A fresh run to a temp directory produces byte-identical artifacts.
 *
 * Node I/O is allowed.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import {
  runSituationEvaluator,
  computeSituationVerdict,
  type SituationEvidenceArtifact,
} from "../../../eval/runners/small-sided-situation-evaluator.js";
import {
  MAPPED_SITUATION_IDS,
  SITUATION_EVIDENCE_REQUIREMENTS,
} from "../../../eval/contracts/situation-mapping.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_1_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-1/situations",
);

/** The four situations covered by this batch */
const BATCH_1_TARGETS = [
  "PASS_RECEPTION",
  "SHOT_TO_RESULT",
  "PHYSICAL_DUEL",
  "SUPPORT_AND_PASSING_LANES",
];

// ---------------------------------------------------------------------------
// Temp dir for re-run comparison
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeAll(() => {
  tmpDir = join("/tmp", `batch1-binding-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterAll(() => {
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 1. Persisted artifacts exist and match the index
// ---------------------------------------------------------------------------

describe("BATCH-1 binding: persisted artifacts exist", () => {
  it("index.json exists in batch-1 dir", () => {
    const indexPath = join(BATCH_1_DIR, "index.json");
    expect(existsSync(indexPath)).toBe(true);
  });

  it("all four target situation artifacts exist", () => {
    const indexPath = join(BATCH_1_DIR, "index.json");
    expect(existsSync(indexPath)).toBe(true);
    const index = JSON.parse(readFileSync(indexPath, "utf-8"));
    const sitIds = new Set(index.situations.map((s: { situation_id: string }) => s.situation_id));

    for (const target of BATCH_1_TARGETS) {
      expect(
        existsSync(join(BATCH_1_DIR, `${target}.json`)),
        `Missing artifact for ${target}`,
      ).toBe(true);
      expect(sitIds.has(target), `${target} should be in index`).toBe(true);
    }
  });

  it("each target artifact's verdict matches the index", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_1_DIR, "index.json"), "utf-8"),
    );

    for (const target of BATCH_1_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_1_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      const indexEntry = index.situations.find(
        (s: { situation_id: string }) => s.situation_id === target,
      );

      expect(indexEntry).toBeDefined();
      expect(artifact.verdict).toBe(indexEntry.verdict);
      expect(artifact.relevant_events.length).toBe(indexEntry.relevant_event_count);
    }
  });

  it("target artifacts have correct mapping references", () => {
    for (const target of BATCH_1_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_1_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      const req = SITUATION_EVIDENCE_REQUIREMENTS[target];
      expect(req).toBeDefined();
      expect(artifact.evidence_requirement.situation_id).toBe(target);
      expect(artifact.evidence_requirement.required_event_kinds).toEqual(req!.required_event_kinds);
      expect(artifact.evidence_requirement.indicative_event_kinds).toEqual(req!.indicative_event_kinds);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Honest verdicts (live re-run match)
// ---------------------------------------------------------------------------

describe("BATCH-1 binding: honest verdicts", () => {
  it("target situations have NOT_EVALUATED verdicts (no events in fixture)", () => {
    for (const target of BATCH_1_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_1_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      expect(artifact.verdict).toBe("NOT_EVALUATED");
      expect(artifact.relevant_events.length).toBe(0);
    }
  });

  it("a fresh run to temp dir produces byte-identical artifacts", () => {
    // Run the evaluator to a temp dir.
    const result = runSituationEvaluator(
      "3v3-situation-fixture.v1.json",
      tmpDir,
    );

    // Compare each target situation artifact against batch-1.
    for (const target of BATCH_1_TARGETS) {
      const batch1Content = readFileSync(
        join(BATCH_1_DIR, `${target}.json`),
        "utf-8",
      );
      const freshContent = readFileSync(
        join(tmpDir, `${target}.json`),
        "utf-8",
      );

      expect(freshContent).toBe(batch1Content,
        `Artifact ${target} from fresh run must match batch-1 persisted artifact`,
      );

      // Also verify verdict in fresh result.
      const artifact = result.situationArtifacts.find((a) => a.situation_id === target);
      expect(artifact).toBeDefined();
      expect(artifact!.verdict).toBe("NOT_EVALUATED");
    }
  });

  it("re-run produces identical index.json", () => {
    const batch1Index = readFileSync(
      join(BATCH_1_DIR, "index.json"),
      "utf-8",
    );

    // Run again to same temp dir (overwrites).
    runSituationEvaluator("3v3-situation-fixture.v1.json", tmpDir);

    const freshIndex = readFileSync(
      join(tmpDir, "index.json"),
      "utf-8",
    );

    expect(freshIndex).toBe(batch1Index);
  });
});

// ---------------------------------------------------------------------------
// 3. Verdict computation is consistent
// ---------------------------------------------------------------------------

describe("BATCH-1 binding: verdict computation", () => {
  it("computeSituationVerdict returns NOT_EVALUATED for empty events", () => {
    for (const target of BATCH_1_TARGETS) {
      const req = SITUATION_EVIDENCE_REQUIREMENTS[target];
      expect(req).toBeDefined();
      const { verdict, reason } = computeSituationVerdict(target, [], req!);
      expect(verdict).toBe("NOT_EVALUATED");
      expect(reason).toContain("No relevant events");
    }
  });

  it("verdict_reason is descriptive", () => {
    for (const target of BATCH_1_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_1_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      expect(artifact.verdict_reason).toContain(target);
      expect(artifact.verdict_reason).toContain("No relevant events");
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Fixture determinism: all 8 situations are NOT_EVALUATED in this fixture
// ---------------------------------------------------------------------------

describe("BATCH-1 binding: full fixture consistency", () => {
  it("all 8 mapped situations are NOT_EVALUATED for 3v3-situation-fixture", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_1_DIR, "index.json"), "utf-8"),
    );

    for (const sit of index.situations) {
      expect(sit.verdict).toBe("NOT_EVALUATED");
    }
  });

  it("total_ticks and seed match the fixture", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_1_DIR, "index.json"), "utf-8"),
    );

    expect(index.totalTicks).toBe(600);
    expect(index.seed).toBe(42);
    expect(index.fixtureName).toBe("3v3-situation-fixture.v1.json");
    expect(index.hasInvariantFailures).toBe(false);
    expect(typeof index.finalStateHash).toBe("string");
    expect(index.finalStateHash).toMatch(/^fnv1a64-v1:/);
  });
});