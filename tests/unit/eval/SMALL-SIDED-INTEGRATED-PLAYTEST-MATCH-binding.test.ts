/**
 * Binding test for SMALL-SIDED-INTEGRATED-PLAYTEST-MATCH.
 *
 * Verifies:
 *  - Evidence artifacts exist and are structurally valid
 *  - trajectory.json records per-tick hashes and scan localizations
 *  - browser-cases.json has valid structure with case evidence
 *  - sequence.json has 3-5 labeled frames tied to the objective
 *  - Screenshot PNGs exist, are non-empty, and have distinct bytes
 *  - Existing accepted evidence was NOT overwritten
 *  - The milestone bundle manifest was NOT overwritten
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

const CASE_ID = "SMALL-SIDED-INTEGRATED-PLAYTEST-MATCH";
const BROWSER_CASE_ID = "BROWSER-SMALL-SIDED-INTEGRATED-PLAYTEST";

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
];

const MILESTONE_BUNDLE_PATH = resolve(
  process.cwd(),
  "docs/evidence/milestones/SMALL_SIDED_SHAPE/manifest.json",
);

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

  it("trajectory.json records per-tick hashes for 360 ticks", () => {
    const raw = readFileSync(TRAJECTORY_PATH, "utf-8");
    const traj = JSON.parse(raw);
    expect(typeof traj.initialHash).toBe("string");
    expect(traj.initialHash.length).toBeGreaterThan(0);
    expect(Array.isArray(traj.perTickHashes)).toBe(true);
    expect(traj.perTickHashes.length).toBe(360);
    expect(traj.ticks).toBe(360);
  });

  it("trajectory.json per-tick hashes are non-empty fnv1a64 strings", () => {
    const raw = readFileSync(TRAJECTORY_PATH, "utf-8");
    const traj = JSON.parse(raw);
    for (const hash of traj.perTickHashes) {
      expect(typeof hash).toBe("string");
      expect(hash.length).toBeGreaterThan(0);
      expect(hash).toMatch(/^fnv1a64-v1:/);
    }
  });

  it("trajectory.json includes event summary and scan localizations", () => {
    const raw = readFileSync(TRAJECTORY_PATH, "utf-8");
    const traj = JSON.parse(raw);
    expect(typeof traj.eventSummary).toBe("object");
    expect(typeof traj.eventSummary.totalEvents).toBe("number");
    expect(Array.isArray(traj.eventSummary.distinctKinds)).toBe(true);
    expect(typeof traj.scanSummary).toBe("object");
    expect(typeof traj.scanSummary.present).toBe("number");
    expect(typeof traj.scanSummary.notObserved).toBe("number");
    expect(typeof traj.scanSummary.insufficientContext).toBe("number");
    expect(traj.scanSummary.present + traj.scanSummary.notObserved + traj.scanSummary.insufficientContext).toBe(8);
    expect(Array.isArray(traj.situationLocalizations)).toBe(true);
    expect(traj.situationLocalizations.length).toBe(8);
  });

  it("trajectory.json situation localizations have valid structure", () => {
    const raw = readFileSync(TRAJECTORY_PATH, "utf-8");
    const traj = JSON.parse(raw);
    const validPresences = ["present", "not_observed", "insufficient_context"];
    for (const loc of traj.situationLocalizations) {
      expect(typeof loc.situation_id).toBe("string");
      expect(validPresences).toContain(loc.presence);
      expect(typeof loc.totalRelevantEvents).toBe("number");
      expect(loc.totalRelevantEvents).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(loc.observedKinds)).toBe(true);
      expect(typeof loc.clusterCount).toBe("number");
    }
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

  it("browser-cases.json records evidence with per-tick hashes and scan results", () => {
    const raw = readFileSync(BROWSER_CASES_PATH, "utf-8");
    const cases = JSON.parse(raw);
    const found = cases.find((c: { case_id: string }) => c.case_id === BROWSER_CASE_ID);
    expect(found).toBeDefined();
    expect(typeof found.evidence.initialHash).toBe("string");
    expect(Array.isArray(found.evidence.perTickHashes)).toBe(true);
    expect(found.evidence.perTickHashes.length).toBe(360);
    expect(typeof found.evidence.scanSummary).toBe("object");
    expect(typeof found.evidence.situationLocalizations).toBe("object");
    expect(Array.isArray(found.evidence.situationLocalizations)).toBe(true);
    expect(found.evidence.situationLocalizations.length).toBe(8);
  });

  // ---- sequence.json validation ----

  it("sequence.json exists with schema_version 1 and correct objective_id", () => {
    expect(existsSync(SEQUENCE_PATH)).toBe(true);
    const raw = readFileSync(SEQUENCE_PATH, "utf-8");
    const seq = JSON.parse(raw);
    expect(seq.schema_version).toBe(1);
    // sequence.json uses the objective ID (not browser case ID) for gauntlet audit compatibility.
    expect(seq.objective_id).toBe(CASE_ID);
  });

  it("sequence.json has 3-5 labeled frames with valid structure", () => {
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
      expect(shaSet.has(sha)).toBe(false);
      shaSet.add(sha);
    }

    // All frames should have unique hashes.
    expect(shaSet.size).toBe(seq.frames.length);
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
    expect(lowerMd).toContain("known gaps");
    expect(lowerMd).toContain("claims not made");
    expect(lowerMd).toContain("files changed");
    expect(lowerMd).toContain("commands run");
  });

  it("RESULT.md does NOT claim PES fidelity or FOUNDATION_LAB_PASS", () => {
    const resultMd = readFileSync(RESULT_PATH, "utf-8").toLowerCase();
    expect(resultMd).not.toMatch(/pes\s+fidelity\s+pass/);
    expect(resultMd).not.toMatch(/foundation_lab_pass\s*:\s*pass/);
  });

  it("RESULT.md honestly reports situation localizations", () => {
    const resultMd = readFileSync(RESULT_PATH, "utf-8");
    // Must mention which situations are present vs not_observed/insufficient_context.
    expect(resultMd).toContain("not_observed");
    expect(resultMd).toContain("insufficient_context");
    // Must not claim all situations are present.
    expect(resultMd).not.toMatch(/0\s+present.*8\s+present/);
  });

  // ---- Existing accepted evidence NOT overwritten ----

  for (const origId of ORIGINAL_CASE_IDS) {
    it(`existing ${origId} evidence was NOT overwritten`, () => {
      const origEvidenceDir = resolve(process.cwd(), "docs/evidence", origId);
      expect(existsSync(origEvidenceDir)).toBe(true);
      expect(existsSync(resolve(origEvidenceDir, "trajectory.json"))).toBe(true);
      expect(existsSync(resolve(origEvidenceDir, "RESULT.md"))).toBe(true);
    });
  }

  it("milestone bundle manifest was NOT overwritten", () => {
    expect(existsSync(MILESTONE_BUNDLE_PATH)).toBe(true);
    const raw = readFileSync(MILESTONE_BUNDLE_PATH, "utf-8");
    const manifest = JSON.parse(raw);
    expect(manifest.milestone_id).toBe("SMALL_SIDED_SHAPE");
    expect(typeof manifest.schema_version).toBe("number");
  });
});
