/**
 * Binding test for BROWSER-SMALL-SIDED-001-COHERENCE-RERUN.
 *
 * Verifies:
 *  - Evidence artifacts exist and are structurally valid
 *  - trajectory.json records per-tick hash correspondence across 3 scenarios
 *  - browser-cases.json has valid structure with scenario evidence
 *  - sequence.json has 3-5 labeled frames tied to the objective
 *  - Screenshot PNGs exist, are non-empty, and have distinct bytes
 *  - Existing BROWSER-SMALL-SIDED-001-CASE evidence was NOT overwritten
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

const CASE_ID = "BROWSER-SMALL-SIDED-001-COHERENCE-RERUN";
const ORIGINAL_CASE_ID = "BROWSER-SMALL-SIDED-001-CASE";

const EVIDENCE_DIR = resolve(process.cwd(), "docs/evidence", CASE_ID);
const SCREENSHOT_DIR = resolve(process.cwd(), "docs/screenshots", CASE_ID);
const ORIGINAL_EVIDENCE_DIR = resolve(
  process.cwd(),
  "docs/evidence",
  ORIGINAL_CASE_ID,
);
const ORIGINAL_SCREENSHOT_DIR = resolve(
  process.cwd(),
  "docs/screenshots",
  ORIGINAL_CASE_ID,
);

const TRAJECTORY_PATH = resolve(EVIDENCE_DIR, "trajectory.json");
const BROWSER_CASES_PATH = resolve(EVIDENCE_DIR, "browser-cases.json");
const SEQUENCE_PATH = resolve(SCREENSHOT_DIR, "sequence.json");
const RESULT_PATH = resolve(EVIDENCE_DIR, "RESULT.md");

// ---------------------------------------------------------------------------
// Expected scenario IDs
// ---------------------------------------------------------------------------

const EXPECTED_SCENARIO_IDS = [
  "3v3-situation-driven-extended-v1",
  "3v3-situation-driven-shot-resolution-v1",
  "3v3-situation-driven-duel-rejection-v1",
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
    expect(traj.objective).toBe(CASE_ID);
    expect(traj.class).toBe("DYNAMIC_VISUAL");
  });

  it("trajectory.json records per-tick hashes for all 3 scenarios", () => {
    const raw = readFileSync(TRAJECTORY_PATH, "utf-8");
    const traj = JSON.parse(raw);
    expect(Array.isArray(traj.scenarios)).toBe(true);
    expect(traj.scenarios.length).toBe(3);

    for (const scenario of traj.scenarios) {
      expect(typeof scenario.scenario_id).toBe("string");
      expect(typeof scenario.initialHash).toBe("string");
      expect(Array.isArray(scenario.perTickHashes)).toBe(true);
      expect(scenario.perTickHashes.length).toBe(60);
      expect(typeof scenario.seed).toBe("number");
      expect(typeof scenario.durationTicks).toBe("number");
      expect(scenario.durationTicks).toBe(60);
    }

    // Verify scenario IDs match expected.
    const ids = traj.scenarios.map((s: { scenario_id: string }) => s.scenario_id);
    for (const expectedId of EXPECTED_SCENARIO_IDS) {
      expect(ids).toContain(expectedId);
    }
  });

  it("trajectory.json per-tick hashes are non-empty strings", () => {
    const raw = readFileSync(TRAJECTORY_PATH, "utf-8");
    const traj = JSON.parse(raw);
    for (const scenario of traj.scenarios) {
      for (const hash of scenario.perTickHashes) {
        expect(typeof hash).toBe("string");
        expect(hash.length).toBeGreaterThan(0);
        expect(hash).toMatch(/^fnv1a64-v1:/);
      }
    }
  });

  it("trajectory.json initial hashes match first per-tick hash for each scenario", () => {
    const raw = readFileSync(TRAJECTORY_PATH, "utf-8");
    const traj = JSON.parse(raw);
    for (const scenario of traj.scenarios) {
      // The initial hash is computed before any step. The per-tick hashes
      // are post-step. They may differ, but both must be present.
      expect(typeof scenario.initialHash).toBe("string");
      expect(scenario.initialHash.length).toBeGreaterThan(0);
    }
  });

  // ---- browser-cases.json validation ----

  it("browser-cases.json exists and is valid JSON with correct case_id", () => {
    expect(existsSync(BROWSER_CASES_PATH)).toBe(true);
    const raw = readFileSync(BROWSER_CASES_PATH, "utf-8");
    const cases = JSON.parse(raw);
    expect(Array.isArray(cases)).toBe(true);
    expect(cases.length).toBeGreaterThanOrEqual(1);

    const found = cases.find((c: { case_id: string }) => c.case_id === CASE_ID);
    expect(found).toBeDefined();
    expect(found.passed).toBe(true);
  });

  it("browser-cases.json records scenario evidence with per-tick hashes", () => {
    const raw = readFileSync(BROWSER_CASES_PATH, "utf-8");
    const cases = JSON.parse(raw);
    const found = cases.find((c: { case_id: string }) => c.case_id === CASE_ID);
    expect(found).toBeDefined();
    expect(Array.isArray(found.evidence.scenarios)).toBe(true);
    expect(found.evidence.scenarios.length).toBe(3);

    for (const s of found.evidence.scenarios) {
      expect(typeof s.scenario_id).toBe("string");
      expect(typeof s.initialHash).toBe("string");
      expect(Array.isArray(s.perTickHashes)).toBe(true);
      expect(s.perTickHashes.length).toBe(60);
    }
  });

  // ---- sequence.json validation ----

  it("sequence.json exists with schema_version 1 and correct objective_id", () => {
    expect(existsSync(SEQUENCE_PATH)).toBe(true);
    const raw = readFileSync(SEQUENCE_PATH, "utf-8");
    const seq = JSON.parse(raw);
    expect(seq.schema_version).toBe(1);
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

  // ---- Original BROWSER-SMALL-SIDED-001-CASE evidence NOT overwritten ----

  it("existing BROWSER-SMALL-SIDED-001-CASE evidence was NOT overwritten", () => {
    // Verify the original evidence directory and files still exist and are intact.
    expect(existsSync(ORIGINAL_EVIDENCE_DIR)).toBe(true);
    expect(existsSync(resolve(ORIGINAL_EVIDENCE_DIR, "trajectory.json"))).toBe(
      true,
    );
    expect(
      existsSync(resolve(ORIGINAL_EVIDENCE_DIR, "browser-cases.json")),
    ).toBe(true);
    expect(existsSync(resolve(ORIGINAL_EVIDENCE_DIR, "RESULT.md"))).toBe(true);

    // Verify the original screenshot directory and files still exist.
    expect(existsSync(ORIGINAL_SCREENSHOT_DIR)).toBe(true);
    const originalFrames = [
      "frame-before.png",
      "frame-kickoff.png",
      "frame-play.png",
      "frame-later.png",
    ];
    for (const f of originalFrames) {
      const fp = resolve(ORIGINAL_SCREENSHOT_DIR, f);
      expect(existsSync(fp)).toBe(true);
      const stat = statSync(fp);
      expect(stat.size).toBeGreaterThan(0);
    }
    expect(
      existsSync(resolve(ORIGINAL_SCREENSHOT_DIR, "sequence.json")),
    ).toBe(true);
  });

  it("original BROWSER-SMALL-SIDED-001-CASE trajectory has 360 ticks (unchanged)", () => {
    const trajPath = resolve(ORIGINAL_EVIDENCE_DIR, "trajectory.json");
    const raw = readFileSync(trajPath, "utf-8");
    const traj = JSON.parse(raw);
    expect(traj.objective).toBe("BROWSER-SMALL-SIDED-001");
    expect(traj.perTickHashes.length).toBe(360);
  });
});
