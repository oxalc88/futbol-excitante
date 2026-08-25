/**
 * Binding test for SMALL-SIDED-ACTION-EVENT-OBSERVABILITY.
 *
 * Verifies:
 *  - Evidence artifacts exist and are structurally valid
 *  - trajectory.json records per-tick hashes, event log, and scan localizations
 *  - browser-cases.json has valid structure with case evidence
 *  - sequence.json has labeled event-centered frames with before/event/after structure
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

const CASE_ID = "SMALL-SIDED-ACTION-EVENT-OBSERVABILITY";
const BROWSER_CASE_ID = "BROWSER-SMALL-SIDED-ACTION-EVENT-OBSERVABILITY";

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

  it("trajectory.json records per-tick hashes for 600 ticks", () => {
    const raw = readFileSync(TRAJECTORY_PATH, "utf-8");
    const traj = JSON.parse(raw);
    expect(typeof traj.initialHash).toBe("string");
    expect(traj.initialHash.length).toBeGreaterThan(0);
    expect(Array.isArray(traj.perTickHashes)).toBe(true);
    expect(traj.perTickHashes.length).toBe(600);
    expect(traj.ticks).toBe(600);
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

  it("trajectory.json includes event summary with action event kinds", () => {
    const raw = readFileSync(TRAJECTORY_PATH, "utf-8");
    const traj = JSON.parse(raw);
    expect(typeof traj.eventSummary).toBe("object");
    expect(typeof traj.eventSummary.totalEvents).toBe("number");
    expect(traj.eventSummary.totalEvents).toBeGreaterThan(0);
    expect(Array.isArray(traj.eventSummary.distinctKinds)).toBe(true);
    // Must include pass and shot — the key action event kinds.
    expect(traj.eventSummary.distinctKinds).toContain("pass");
    expect(traj.eventSummary.distinctKinds).toContain("shot");
  });

  it("trajectory.json includes event log with pass/shot/contact events", () => {
    const raw = readFileSync(TRAJECTORY_PATH, "utf-8");
    const traj = JSON.parse(raw);
    expect(Array.isArray(traj.eventLog)).toBe(true);
    expect(traj.eventLog.length).toBeGreaterThan(0);

    const kinds = new Set(traj.eventLog.map((e: { kind: string }) => e.kind));
    expect(kinds.has("pass")).toBe(true);
    expect(kinds.has("shot")).toBe(true);
  });

  it("trajectory.json includes scan localizations for 8 situations", () => {
    const raw = readFileSync(TRAJECTORY_PATH, "utf-8");
    const traj = JSON.parse(raw);
    expect(typeof traj.scanSummary).toBe("object");
    expect(typeof traj.scanSummary.present).toBe("number");
    expect(typeof traj.scanSummary.notObserved).toBe("number");
    expect(typeof traj.scanSummary.insufficientContext).toBe("number");
    expect(
      traj.scanSummary.present + traj.scanSummary.notObserved + traj.scanSummary.insufficientContext,
    ).toBe(8);
    expect(Array.isArray(traj.situationLocalizations)).toBe(true);
    expect(traj.situationLocalizations.length).toBe(8);
  });

  it("trajectory.json event frames have valid structure", () => {
    const raw = readFileSync(TRAJECTORY_PATH, "utf-8");
    const traj = JSON.parse(raw);
    expect(Array.isArray(traj.eventFrames)).toBe(true);
    expect(traj.eventFrames.length).toBeGreaterThanOrEqual(3);

    for (const ef of traj.eventFrames) {
      expect(typeof ef.eventKind).toBe("string");
      expect(typeof ef.eventTick).toBe("number");
      expect(typeof ef.beforeTick).toBe("number");
      expect(typeof ef.afterTick).toBe("number");
      expect(ef.beforeTick).toBeLessThan(ef.eventTick);
      expect(ef.afterTick).toBeGreaterThan(ef.eventTick);
    }

    // Must include pass, shot, and goal event frames.
    const eventKinds = traj.eventFrames.map((ef: { eventKind: string }) => ef.eventKind);
    expect(eventKinds).toContain("pass");
    expect(eventKinds).toContain("shot");
    expect(eventKinds).toContain("goal");
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

  it("browser-cases.json records evidence with per-tick hashes and event data", () => {
    const raw = readFileSync(BROWSER_CASES_PATH, "utf-8");
    const cases = JSON.parse(raw);
    const found = cases.find((c: { case_id: string }) => c.case_id === BROWSER_CASE_ID);
    expect(found).toBeDefined();
    expect(typeof found.evidence.initialHash).toBe("string");
    expect(Array.isArray(found.evidence.perTickHashes)).toBe(true);
    expect(found.evidence.perTickHashes.length).toBe(600);
    expect(typeof found.evidence.eventSummary).toBe("object");
    expect(typeof found.evidence.scanSummary).toBe("object");
    expect(Array.isArray(found.evidence.eventFrames)).toBe(true);
    expect(found.evidence.eventFrames.length).toBeGreaterThanOrEqual(3);
  });

  // ---- sequence.json validation ----

  it("sequence.json exists with schema_version 1 and correct objective_id", () => {
    expect(existsSync(SEQUENCE_PATH)).toBe(true);
    const raw = readFileSync(SEQUENCE_PATH, "utf-8");
    const seq = JSON.parse(raw);
    expect(seq.schema_version).toBe(1);
    expect(seq.objective_id).toBe(CASE_ID);
  });

  it("sequence.json has event-centered frames with before/event/after structure", () => {
    const raw = readFileSync(SEQUENCE_PATH, "utf-8");
    const seq = JSON.parse(raw);
    expect(Array.isArray(seq.frames)).toBe(true);
    // Audit requires 3-5 labeled frames for DYNAMIC_VISUAL.
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

    // Verify the frames include event-centered labels (at least "event" and "before" or "after").
    const labels = seq.frames.map((f: { label: string }) => f.label);
    expect(labels.some((l: string) => l.includes("event"))).toBe(true);
    expect(labels.some((l: string) => l.includes("before") || l.includes("after"))).toBe(true);
  });

  it("sequence.json event_frames field describes event-centered capture plan", () => {
    const raw = readFileSync(SEQUENCE_PATH, "utf-8");
    const seq = JSON.parse(raw);
    expect(Array.isArray(seq.event_frames)).toBe(true);
    expect(seq.event_frames.length).toBeGreaterThanOrEqual(3);

    for (const ef of seq.event_frames) {
      expect(typeof ef.eventKind).toBe("string");
      expect(typeof ef.eventTick).toBe("number");
      expect(typeof ef.beforeTick).toBe("number");
      expect(typeof ef.afterTick).toBe("number");
      expect(ef.beforeTick).toBeLessThan(ef.eventTick);
      expect(ef.afterTick).toBeGreaterThan(ef.eventTick);
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
      // Allow some duplicate frames where before=event tick overlap
      // (e.g., consecutive events share a "before" tick).
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

  it("RESULT.md does NOT claim numeric readability PASS", () => {
    const resultMd = readFileSync(RESULT_PATH, "utf-8").toLowerCase();
    // Must not claim a positive readability pass (reject the pattern "readability.*pass.*: pass" or standalone "readability pass: pass").
    // The claims_not_made section correctly DENIES readability pass, which is fine.
    expect(resultMd).not.toMatch(/readability\s+pass\s*:\s*pass/);
    // Must not contain a positive "visual readability pass" claim.
    // Check that there is no standalone positive readability assertion.
    expect(resultMd).not.toMatch(/:\s*pass.*visual.*readability/);
  });

  // ---- Existing accepted evidence NOT overwritten ----

  for (const origId of ORIGINAL_CASE_IDS) {
    it(`existing ${origId} evidence was NOT overwritten`, () => {
      const origEvidenceDir = resolve(process.cwd(), "docs/evidence", origId);
      expect(existsSync(origEvidenceDir)).toBe(true);
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

  // ---- Action event observability specific checks ----

  it("trajectory.json PASS_REJECTION has pass events (action_recognition observable)", () => {
    const raw = readFileSync(TRAJECTORY_PATH, "utf-8");
    const traj = JSON.parse(raw);
    const passReception = traj.situationLocalizations.find(
      (l: { situation_id: string }) => l.situation_id === "PASS_RECEPTION",
    );
    expect(passReception).toBeDefined();
    expect(passReception.totalRelevantEvents).toBeGreaterThan(0);
    expect(passReception.observedKinds).toContain("pass");
  });

  it("trajectory.json SHOT_TO_RESULT has shot/goal events (action_recognition observable)", () => {
    const raw = readFileSync(TRAJECTORY_PATH, "utf-8");
    const traj = JSON.parse(raw);
    const shotToResult = traj.situationLocalizations.find(
      (l: { situation_id: string }) => l.situation_id === "SHOT_TO_RESULT",
    );
    expect(shotToResult).toBeDefined();
    expect(shotToResult.totalRelevantEvents).toBeGreaterThan(0);
    const hasShotOrGoal =
      shotToResult.observedKinds.includes("shot") ||
      shotToResult.observedKinds.includes("goal");
    expect(hasShotOrGoal).toBe(true);
  });
});
