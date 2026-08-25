/**
 * Binding test for SMALL-SIDED-VISUAL-READABILITY-EVIDENCE.
 *
 * Verifies:
 *  - Each of the 8 visual_readability_dimensions appears in sequence.json
 *  - Each dimension's sequence is event-centered (before/event/after labels)
 *  - Each dimension has ≥3 frames in its event-centered sequence
 *  - The on-disk sequence.json matches a fresh parse
 *  - Frame PNG files exist, are non-empty, and have distinct bytes
 *  - NO claim of a numeric readability PASS is asserted in RESULT.md
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const EVIDENCE_DIR = resolve(
  process.cwd(),
  "docs/evidence/SMALL-SIDED-VISUAL-READABILITY-EVIDENCE",
);
const SCREENSHOT_DIR = resolve(
  process.cwd(),
  "docs/screenshots/SMALL-SIDED-VISUAL-READABILITY-EVIDENCE",
);
const SEQUENCE_PATH = resolve(EVIDENCE_DIR, "sequence.json");
const RESULT_PATH = resolve(EVIDENCE_DIR, "RESULT.md");

// ---------------------------------------------------------------------------
// Expected dimensions
// ---------------------------------------------------------------------------

const EXPECTED_DIMENSIONS = [
  "ball_readability_under_congestion",
  "team_classification",
  "facing_orientation",
  "action_recognition",
  "contact_comprehension",
  "team_shape_readability",
  "camera_readability",
  "silhouette_stability",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readSequenceJson(): Record<string, unknown> {
  const raw = readFileSync(SEQUENCE_PATH, "utf-8");
  return JSON.parse(raw);
}

function sha256Bytes(data: Buffer): string {
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(data).digest("hex");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SMALL-SIDED-VISUAL-READABILITY-EVIDENCE binding", () => {
  it("sequence.json exists and is valid JSON with schema_version 1", () => {
    expect(existsSync(SEQUENCE_PATH)).toBe(true);
    const seq = readSequenceJson();
    expect(seq.schema_version).toBe(1);
    expect(seq.objective_id).toBe("SMALL-SIDED-VISUAL-READABILITY-EVIDENCE");
  });

  it("all 8 dimensions appear in sequence.json", () => {
    const seq = readSequenceJson() as {
      dimensions?: Array<{ dimension: string }>;
    };
    expect(seq.dimensions).toBeDefined();
    expect(Array.isArray(seq.dimensions)).toBe(true);

    const foundDims = new Set(
      (seq.dimensions ?? []).map((d) => d.dimension),
    );
    for (const dim of EXPECTED_DIMENSIONS) {
      expect(foundDims.has(dim)).toBe(true);
    }
  });

  it("each dimension has ≥3 event-centered frames with before/event/after labels", () => {
    const seq = readSequenceJson() as {
      dimensions?: Array<{
        dimension: string;
        event_centered_sequence?: Array<{
          label: string;
          path: string;
          tick: number;
          note: string;
        }>;
      }>;
    };

    for (const dim of seq.dimensions ?? []) {
      expect(dim.event_centered_sequence).toBeDefined();
      expect(Array.isArray(dim.event_centered_sequence)).toBe(true);
      expect(dim.event_centered_sequence!.length).toBeGreaterThanOrEqual(3);

      const labels = dim.event_centered_sequence!.map((f) => f.label);
      expect(labels).toContain("before");
      expect(labels).toContain("event");
      expect(labels).toContain("after");

      // Each frame should reference a tick (event-centered, not just tick-sliced).
      for (const frame of dim.event_centered_sequence!) {
        expect(frame.tick).toBeGreaterThanOrEqual(0);
        expect(typeof frame.note).toBe("string");
        expect(frame.note.length).toBeGreaterThan(0);
      }
    }
  });

  it("sequence.json flat frames array matches dimensions (24 total)", () => {
    const seq = readSequenceJson() as {
      frames?: Array<{ dimension: string; label: string }>;
    };
    expect(seq.frames).toBeDefined();
    expect(Array.isArray(seq.frames)).toBe(true);
    expect(seq.frames!.length).toBe(24); // 8 dimensions × 3 frames

    // Each frame in the flat array should reference a valid dimension.
    const dims = new Set(EXPECTED_DIMENSIONS);
    for (const frame of seq.frames!) {
      expect(dims.has(frame.dimension)).toBe(true);
    }
  });

  it("sequence.json on-disk matches fresh parse (idempotent read)", () => {
    const raw1 = readFileSync(SEQUENCE_PATH, "utf-8");
    const parsed1 = JSON.parse(raw1);
    const reconstituted = JSON.stringify(parsed1, null, 2);
    // Allow for trailing newline difference.
    expect(raw1.trimEnd()).toBe(reconstituted.trimEnd());
  });

  it("frame PNG files exist, are non-empty, and have distinct bytes", () => {
    const seq = readSequenceJson() as {
      frames?: Array<{ dimension: string; label: string; path: string }>;
    };
    expect(seq.frames).toBeDefined();

    const shaSet = new Set<string>();

    for (const frame of seq.frames!) {
      const filePath = resolve(SCREENSHOT_DIR, frame.path);
      expect(existsSync(filePath)).toBe(true);

      const stat = statSync(filePath);
      expect(stat.size).toBeGreaterThan(0);

      // Compute SHA256 and verify uniqueness.
      const data = readFileSync(filePath);
      const sha = sha256Bytes(data);
      expect(shaSet.has(sha)).toBe(false);
      shaSet.add(sha);
    }

    // All 24 frames should have unique hashes.
    expect(shaSet.size).toBe(24);
  });

  it("RESULT.md does NOT assert a numeric readability PASS", () => {
    expect(existsSync(RESULT_PATH)).toBe(true);
    const resultMd = readFileSync(RESULT_PATH, "utf-8");
    const lowerMd = resultMd.toLowerCase();

    // Must not contain standalone readability PASS claims.
    // "readability pass" must always appear in a negated context (not/no/does not).
    const passMatches = [...lowerMd.matchAll(/readability pass/g)];
    for (const match of passMatches) {
      const pos = match.index ?? 0;
      const preceding = lowerMd.substring(Math.max(0, pos - 40), pos);
      const isNegated =
        preceding.includes("not ") ||
        preceding.includes("no ") ||
        preceding.includes("does not") ||
        preceding.includes("didn't");
      expect(isNegated).toBe(true);
    }

    // Must not assert readability scores or thresholds.
    expect(resultMd).not.toMatch(/readability\s+score\s*[:=]/i);
    expect(resultMd).not.toMatch(/readability\s+threshold\s*(met|pass|achieved)/i);

    // Must contain the honesty marker.
    expect(lowerMd).toContain("observability evidence");
  });
});
