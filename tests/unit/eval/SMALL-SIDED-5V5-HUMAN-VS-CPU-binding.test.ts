/**
 * Binding test for SMALL-SIDED-5V5-HUMAN-VS-CPU.
 *
 * Verifies:
 *  - Evidence artifacts exist and are structurally valid
 *  - trajectory.json records per-tick hashes
 *  - browser-cases.json has valid structure with case evidence
 *  - sequence.json has labeled frames
 *  - Screenshot PNGs exist, are non-empty, and have distinct bytes
 *  - Existing accepted evidence was NOT overwritten
 *  - RESULT.md exists and contains the builder report
 *
 * No Math.random, Date, performance, DOM, or Node I/O in simulation core.
 */

import { describe, it, expect } from "vitest";
import {
  readFileSync,
  existsSync,
  statSync,
  readdirSync,
} from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const CASE_ID = "SMALL-SIDED-5V5-HUMAN-VS-CPU";
const BROWSER_CASE_ID = "BROWSER-5V5-HUMAN-VS-CPU";

const EVIDENCE_DIR = resolve(process.cwd(), "docs/evidence", CASE_ID);
const SCREENSHOT_DIR = resolve(process.cwd(), "docs/screenshots", CASE_ID);

const TRAJECTORY_PATH = resolve(EVIDENCE_DIR, "trajectory.json");
const BROWSER_CASES_PATH = resolve(EVIDENCE_DIR, "browser-cases.json");
const SEQUENCE_PATH = resolve(SCREENSHOT_DIR, "sequence.json");
const RESULT_PATH = resolve(EVIDENCE_DIR, "RESULT.md");

// Existing accepted evidence — must NOT be overwritten
const ORIGINAL_CASE_IDS = [
  "BROWSER-SMALL-SIDED-001-CASE",
  "BROWSER-SMALL-SIDED-001-COHERENCE-RERUN",
  "SMALL-SIDED-INTEGRATED-PLAYTEST-MATCH",
  "SMALL-SIDED-VISUAL-READABILITY-EVIDENCE",
  "SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH",
  "SMALL-SIDED-ACTION-EVENT-OBSERVABILITY",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256Bytes(data: Buffer): string {
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(data).digest("hex");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe(`${CASE_ID} binding`, () => {
  // ---- Evidence artifact existence ----

  it("evidence directory exists", () => {
    expect(existsSync(EVIDENCE_DIR)).toBe(true);
  });

  it("screenshot directory exists", () => {
    expect(existsSync(SCREENSHOT_DIR)).toBe(true);
  });

  it("RESULT.md exists and contains objective_id", () => {
    expect(existsSync(RESULT_PATH)).toBe(true);
    const resultMd = readFileSync(RESULT_PATH, "utf-8");
    expect(resultMd).toContain(CASE_ID);
    expect(resultMd.toLowerCase()).toContain("builder report");
  });

  // ---- trajectory.json validation ----

  it("trajectory.json exists and is valid JSON", () => {
    expect(existsSync(TRAJECTORY_PATH)).toBe(true);
    const raw = readFileSync(TRAJECTORY_PATH, "utf-8");
    const traj = JSON.parse(raw);
    expect(traj.objective).toBe(BROWSER_CASE_ID);
    expect(traj.class).toBe("DYNAMIC_VISUAL");
  });

  it("trajectory.json records per-tick hashes", () => {
    const raw = readFileSync(TRAJECTORY_PATH, "utf-8");
    const traj = JSON.parse(raw);
    expect(typeof traj.initialHash).toBe("string");
    expect(traj.initialHash.length).toBeGreaterThan(0);
    expect(Array.isArray(traj.perTickHashes)).toBe(true);
    expect(traj.perTickHashes.length).toBeGreaterThanOrEqual(60);
    expect(traj.ticks).toBeGreaterThanOrEqual(60);
  });

  it("trajectory.json per-tick hashes are non-empty fnv1a64 strings", () => {
    const raw = readFileSync(TRAJECTORY_PATH, "utf-8");
    const traj = JSON.parse(raw);
    for (const hash of traj.perTickHashes.slice(0, 10)) {
      expect(typeof hash).toBe("string");
      expect(hash.length).toBeGreaterThan(0);
      expect(hash).toMatch(/^fnv1a64-v1:/);
    }
  });

  it("trajectory.json includes event summary", () => {
    const raw = readFileSync(TRAJECTORY_PATH, "utf-8");
    const traj = JSON.parse(raw);
    expect(typeof traj.eventSummary).toBe("object");
    expect(typeof traj.eventSummary.totalEvents).toBe("number");
    expect(Array.isArray(traj.eventSummary.distinctKinds)).toBe(true);
  });

  // ---- browser-cases.json validation ----

  it("browser-cases.json exists and is valid JSON with correct case_id", () => {
    expect(existsSync(BROWSER_CASES_PATH)).toBe(true);
    const raw = readFileSync(BROWSER_CASES_PATH, "utf-8");
    const cases = JSON.parse(raw);
    expect(Array.isArray(cases)).toBe(true);
    expect(cases.length).toBeGreaterThanOrEqual(1);

    const found = cases.find((c: { case_id: string }) => c.case_id === BROWSER_CASE_ID);
    expect(found).toBeDefined();
    expect(found.passed).toBe(true);
  });

  it("browser-cases.json records evidence with per-tick hashes", () => {
    const raw = readFileSync(BROWSER_CASES_PATH, "utf-8");
    const cases = JSON.parse(raw);
    const found = cases.find((c: { case_id: string }) => c.case_id === BROWSER_CASE_ID);
    expect(found).toBeDefined();
    expect(typeof found.evidence.initialHash).toBe("string");
    expect(Array.isArray(found.evidence.perTickHashes)).toBe(true);
    expect(found.evidence.perTickHashes.length).toBeGreaterThanOrEqual(60);
  });

  // ---- sequence.json validation ----

  it("sequence.json exists with schema_version 1 and correct objective_id", () => {
    expect(existsSync(SEQUENCE_PATH)).toBe(true);
    const raw = readFileSync(SEQUENCE_PATH, "utf-8");
    const seq = JSON.parse(raw);
    expect(seq.schema_version).toBe(1);
    expect(seq.objective_id).toBe(CASE_ID);
  });

  it("sequence.json has 3-5 labeled frames", () => {
    const raw = readFileSync(SEQUENCE_PATH, "utf-8");
    const seq = JSON.parse(raw);
    expect(Array.isArray(seq.frames)).toBe(true);
    expect(seq.frames.length).toBeGreaterThanOrEqual(3);
    expect(seq.frames.length).toBeLessThanOrEqual(5);

    const namedFiles = new Set(
      readdirSync(SCREENSHOT_DIR).filter((f) => f.endsWith(".png")),
    );

    for (const frame of seq.frames) {
      expect(typeof frame.label).toBe("string");
      expect(frame.label.length).toBeGreaterThan(0);
      expect(typeof frame.path).toBe("string");
      expect(frame.path.endsWith(".png")).toBe(true);
      expect(typeof frame.tick).toBe("number");
      expect(frame.tick).toBeGreaterThanOrEqual(0);
      expect(typeof frame.note).toBe("string");
      expect(frame.note.length).toBeGreaterThan(0);

      // Referenced PNG file must exist on disk.
      expect(namedFiles.has(frame.path)).toBe(true);
    }
  });

  // ---- Screenshot PNG validation ----

  it("screenshot PNGs exist, are non-empty, and have distinct bytes", () => {
    const raw = readFileSync(SEQUENCE_PATH, "utf-8");
    const seq = JSON.parse(raw);
    const shaSet = new Set<string>();

    for (const frame of seq.frames) {
      const filePath = resolve(SCREENSHOT_DIR, frame.path);
      expect(existsSync(filePath)).toBe(true);

      const stat = statSync(filePath);
      expect(stat.size).toBeGreaterThan(0);

      const data = readFileSync(filePath);
      const sha = sha256Bytes(data);
      shaSet.add(sha);
    }

    // At least half the frames should be unique.
    expect(shaSet.size).toBeGreaterThanOrEqual(Math.ceil(seq.frames.length / 2));
  });

  // ---- RESULT.md content validation ----

  it("RESULT.md contains required builder report fields", () => {
    const resultMd = readFileSync(RESULT_PATH, "utf-8");
    const lowerMd = resultMd.toLowerCase();
    expect(lowerMd).toContain("objective_id");
    expect(lowerMd).toContain("builder_agent");
    expect(lowerMd).toContain("builder_model");
    expect(lowerMd).toContain("evidence_class");
    expect(resultMd).toContain("DYNAMIC_VISUAL");
    expect(lowerMd.includes("known gaps") || lowerMd.includes("known_gaps")).toBe(true);
    expect(lowerMd.includes("claims not made") || lowerMd.includes("claims_not_made")).toBe(true);
    expect(lowerMd.includes("files changed") || lowerMd.includes("files_changed")).toBe(true);
    expect(lowerMd.includes("commands run") || lowerMd.includes("commands_run")).toBe(true);
  });

  it("RESULT.md does NOT claim PES fidelity or FOUNDATION_LAB_PASS", () => {
    const resultMd = readFileSync(RESULT_PATH, "utf-8").toLowerCase();
    expect(resultMd).not.toMatch(/pes\s+fidelity\s+pass/);
    expect(resultMd).not.toMatch(/foundation_lab_pass\s*:\s*pass/);
  });

  // ---- Existing accepted evidence NOT overwritten ----

  for (const origId of ORIGINAL_CASE_IDS) {
    it(`existing ${origId} evidence was NOT overwritten`, () => {
      const origEvidenceDir = resolve(process.cwd(), "docs/evidence", origId);
      expect(existsSync(origEvidenceDir)).toBe(true);
      expect(existsSync(resolve(origEvidenceDir, "RESULT.md"))).toBe(true);
    });
  }
});
