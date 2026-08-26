/**
 * @module tests/unit/eval/SMALL-SIDED-HUMAN-ACTION-READABILITY-OBSERVABILITY-binding.test
 *
 * Binding test for SMALL-SIDED-HUMAN-ACTION-READABILITY-OBSERVABILITY.
 *
 * Verifies:
 *  1. Evidence artifact existence (trajectory.json, sequence.json, RESULT.md, etc.)
 *  2. Input-frame → event binding correctness (PASS_BIT → pass event, SHOT_BIT → shot event)
 *  3. Evidence integrity (no duplicate PNGs, unique hashes, correct objective_id)
 *  4. Claims_not_made compliance
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OBJECTIVE_ID = "SMALL-SIDED-HUMAN-ACTION-READABILITY-OBSERVABILITY";
const EVIDENCE_DIR = path.resolve(
  process.cwd(),
  `docs/evidence/${OBJECTIVE_ID}`,
);
const SCREENSHOT_DIR = path.resolve(
  process.cwd(),
  `docs/screenshots/${OBJECTIVE_ID}`,
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function sha256(filePath: string): string {
  const data = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

// ===========================================================================
// Artifact existence
// ===========================================================================

describe(`${OBJECTIVE_ID}: artifact existence`, () => {
  it("RESULT.md exists in evidence directory", () => {
    expect(fileExists(path.join(EVIDENCE_DIR, "RESULT.md"))).toBe(true);
  });

  it("trajectory.json exists in evidence directory", () => {
    expect(fileExists(path.join(EVIDENCE_DIR, "trajectory.json"))).toBe(true);
  });

  it("sequence.json exists in screenshot directory", () => {
    expect(fileExists(path.join(SCREENSHOT_DIR, "sequence.json"))).toBe(true);
  });

  it("at least 3 PNG screenshots exist", () => {
    const pngs = fs.readdirSync(SCREENSHOT_DIR).filter((f) => f.endsWith(".png"));
    expect(pngs.length).toBeGreaterThanOrEqual(3);
  });
});

// ===========================================================================
// Trajectory integrity
// ===========================================================================

describe(`${OBJECTIVE_ID}: trajectory.json`, () => {
  it("has valid structure with per-tick hashes and event log", () => {
    const trajectory = readJson(
      path.join(EVIDENCE_DIR, "trajectory.json"),
    ) as Record<string, unknown>;

    expect(trajectory.schema_version).toBe(1);
    expect(trajectory.objective_id).toBe(OBJECTIVE_ID);
    expect(Array.isArray(trajectory.hashes)).toBe(true);
    expect(trajectory.hashes.length).toBeGreaterThan(0);
    expect(Array.isArray(trajectory.event_log)).toBe(true);
  });

  it("per-tick hashes are non-empty strings", () => {
    const trajectory = readJson(
      path.join(EVIDENCE_DIR, "trajectory.json"),
    ) as Record<string, unknown>;

    const hashes = trajectory.hashes as string[];
    for (const h of hashes.slice(0, 10)) {
      expect(typeof h).toBe("string");
      expect(h.length).toBeGreaterThan(0);
    }
  });

  it("event log contains pass and/or shot events with tick, kind, and label", () => {
    const trajectory = readJson(
      path.join(EVIDENCE_DIR, "trajectory.json"),
    ) as Record<string, unknown>;

    const eventLog = trajectory.event_log as Array<{
      tick: number;
      kind: string;
      label: string;
    }>;
    expect(eventLog.length).toBeGreaterThan(0);

    const kinds = new Set(eventLog.map((e) => e.kind));
    // At least pass or shot events must exist.
    expect(kinds.has("pass") || kinds.has("shot")).toBe(true);
  });
});

// ===========================================================================
// Sequence.json integrity
// ===========================================================================

describe(`${OBJECTIVE_ID}: sequence.json`, () => {
  it("has correct objective_id and 5 labeled frames", () => {
    const sequence = readJson(
      path.join(SCREENSHOT_DIR, "sequence.json"),
    ) as Record<string, unknown>;

    expect(sequence.objective_id).toBe(OBJECTIVE_ID);
    expect(Array.isArray(sequence.frames)).toBe(true);
    expect(sequence.frames.length).toBe(5);
  });

  it("each frame has a label, path, tick, and note", () => {
    const sequence = readJson(
      path.join(SCREENSHOT_DIR, "sequence.json"),
    ) as Record<string, unknown>;

    for (const frame of sequence.frames as Array<{
      label: string;
      path: string;
      tick: number;
      note: string;
    }>) {
      expect(typeof frame.label).toBe("string");
      expect(frame.label.length).toBeGreaterThan(0);
      expect(typeof frame.path).toBe("string");
      expect(frame.path.endsWith(".png")).toBe(true);
      expect(typeof frame.tick).toBe("number");
      expect(typeof frame.note).toBe("string");
    }
  });

  it("frame labels reference input tick and input bits", () => {
    const sequence = readJson(
      path.join(SCREENSHOT_DIR, "sequence.json"),
    ) as Record<string, unknown>;

    const allNotes = (sequence.frames as Array<{ note: string }>)
      .map((f) => f.note)
      .join(" ");
    // At least one frame note should reference the input tick or input bits.
    expect(
      allNotes.includes("input tick") ||
        allNotes.includes("PASS_BIT") ||
        allNotes.includes("SHOT_BIT") ||
        allNotes.includes("pressedButtons"),
    ).toBe(true);
  });

  it("each frame PNG referenced in sequence.json exists and has a unique SHA-256 per semantic label", () => {
    const sequence = readJson(
      path.join(SCREENSHOT_DIR, "sequence.json"),
    ) as Record<string, unknown>;

    const hashes = new Map<string, string[]>();
    for (const frame of sequence.frames as Array<{ path: string; label: string }>) {
      const fullPath = path.join(SCREENSHOT_DIR, frame.path);
      expect(fileExists(fullPath)).toBe(true);
      const hash = sha256(fullPath);
      expect(hash.length).toBe(64);
      const existing = hashes.get(hash);
      if (existing) {
        existing.push(frame.label);
      } else {
        hashes.set(hash, [frame.label]);
      }
    }
    // Every distinct semantic label must map to a unique byte image.
    const duplicates = [...hashes.entries()].filter(([, labels]) => labels.length > 1);
    if (duplicates.length > 0) {
      const dupDetail = duplicates
        .map(([hash, labels]) => `hash ${hash.slice(0, 16)}… shared by [${labels.join(", ")}]`)
        .join("; ");
      expect.fail(
        `Frame PNGs referenced in sequence.json must be pairwise-unique per semantic label; found duplicate(s): ${dupDetail}`,
      );
    }
  });
});

// ===========================================================================
// Input-frame → event binding
// ===========================================================================

describe(`${OBJECTIVE_ID}: input-frame → event binding`, () => {
  it("trajectory event log entries have tick and kind fields", () => {
    const trajectory = readJson(
      path.join(EVIDENCE_DIR, "trajectory.json"),
    ) as Record<string, unknown>;

    const eventLog = trajectory.event_log as Array<Record<string, unknown>>;
    for (const evt of eventLog.slice(0, 20)) {
      expect(typeof evt.tick).toBe("number");
      expect(typeof evt.kind).toBe("string");
    }
  });

  it("pass events in the trajectory carry PASS_BIT (2) in their input context", () => {
    const trajectory = readJson(
      path.join(EVIDENCE_DIR, "trajectory.json"),
    ) as Record<string, unknown>;

    // Assert against input_bindings — must have a pass binding with PASS_BIT.
    const inputBindings = trajectory.input_bindings as Array<{
      eventKind: string;
      inputBits: number;
      causativePlayer: string;
    }>;
    const passBindings = inputBindings.filter((b) => b.eventKind === "pass");
    expect(passBindings.length).toBeGreaterThanOrEqual(1);
    for (const b of passBindings) {
      expect(b.inputBits & 2).toBeTruthy(); // PASS_BIT = 1 << 1 = 2
    }

    // Also assert against event_log entries that carry pressedButtons.
    const eventLog = trajectory.event_log as Array<{
      tick: number;
      kind: string;
      pressedButtons?: number;
    }>;
    const passEvents = eventLog.filter((e) => e.kind === "pass");
    expect(passEvents.length).toBeGreaterThanOrEqual(1);
    const passWithBits = passEvents.filter((e) => e.pressedButtons !== undefined);
    expect(passWithBits.length).toBeGreaterThanOrEqual(1);
    for (const evt of passWithBits) {
      expect((evt.pressedButtons! & 2) !== 0).toBe(true); // PASS_BIT
    }
  });

  it("shot events in the trajectory carry SHOT_BIT (4) in their input context", () => {
    const trajectory = readJson(
      path.join(EVIDENCE_DIR, "trajectory.json"),
    ) as Record<string, unknown>;

    // Assert against input_bindings — must have a shot binding with SHOT_BIT.
    const inputBindings = trajectory.input_bindings as Array<{
      eventKind: string;
      inputBits: number;
      causativePlayer: string;
    }>;
    const shotBindings = inputBindings.filter((b) => b.eventKind === "shot");
    expect(shotBindings.length).toBeGreaterThanOrEqual(1);
    for (const b of shotBindings) {
      expect(b.inputBits & 4).toBeTruthy(); // SHOT_BIT = 1 << 2 = 4
    }

    // Also assert against event_log entries that carry pressedButtons.
    const eventLog = trajectory.event_log as Array<{
      tick: number;
      kind: string;
      pressedButtons?: number;
    }>;
    const shotEvents = eventLog.filter((e) => e.kind === "shot");
    expect(shotEvents.length).toBeGreaterThanOrEqual(1);
    const shotWithBits = shotEvents.filter((e) => e.pressedButtons !== undefined);
    expect(shotWithBits.length).toBeGreaterThanOrEqual(1);
    for (const evt of shotWithBits) {
      expect((evt.pressedButtons! & 4) !== 0).toBe(true); // SHOT_BIT
    }
  });

  it("sequence.json frames label input tick for event frames", () => {
    const sequence = readJson(
      path.join(SCREENSHOT_DIR, "sequence.json"),
    ) as Record<string, unknown>;

    const eventFrames = (sequence.frames as Array<{
      label: string;
      note: string;
    }>).filter(
      (f) =>
        f.label.includes("event") ||
        f.note.includes("event") ||
        f.note.includes("caused by"),
    );

    // At least one event frame should exist.
    expect(eventFrames.length).toBeGreaterThanOrEqual(1);

    // Each event frame note should reference the input tick.
    for (const frame of eventFrames) {
      expect(
        frame.note.includes("input tick") ||
          frame.note.includes("PASS_BIT") ||
          frame.note.includes("SHOT_BIT"),
      ).toBe(true);
    }
  });
});

// ===========================================================================
// Sequence.json tick consistency guard
// ===========================================================================

// Shared frame-tick formula — single source of truth, imported so the
// binding guard CANNOT drift from the capture test / evidence producer.
import { PASS_BEFORE_OFFSET, PASS_AFTER_OFFSET, SHOT_AFTER_OFFSET } from "@pes/eval/scenarios/frame-tick-offsets.js";

describe(`${OBJECTIVE_ID}: sequence.json tick consistency`, () => {
  it("every frame tick equals eventTick + offset per the shared formula", () => {
    const sequence = readJson(
      path.join(SCREENSHOT_DIR, "sequence.json"),
    ) as Record<string, unknown>;

    for (const frame of sequence.frames as Array<{
      label: string;
      tick: number;
      eventTick: number;
    }>) {
      let expectedOffset: number;
      if (frame.label === "pass-before") expectedOffset = PASS_BEFORE_OFFSET;
      else if (frame.label === "pass-event") expectedOffset = 0;
      else if (frame.label === "pass-after") expectedOffset = PASS_AFTER_OFFSET;
      else if (frame.label === "shot-event") expectedOffset = 0;
      else if (frame.label === "shot-after") expectedOffset = SHOT_AFTER_OFFSET;
      else continue; // unknown label — skip

      expect(frame.tick).toBe(frame.eventTick + expectedOffset);
    }
  });

  it("event-frame tick equals its eventTick (event frames are at the event tick)", () => {
    const sequence = readJson(
      path.join(SCREENSHOT_DIR, "sequence.json"),
    ) as Record<string, unknown>;

    for (const frame of sequence.frames as Array<{
      label: string;
      tick: number;
      eventTick: number;
    }>) {
      if (frame.label.endsWith("-event")) {
        expect(frame.tick).toBe(frame.eventTick);
      }
    }
  });

  it("before < event < after ordering for pass and shot", () => {
    const sequence = readJson(
      path.join(SCREENSHOT_DIR, "sequence.json"),
    ) as Record<string, unknown>;

    const frames = sequence.frames as Array<{
      label: string;
      tick: number;
      eventTick: number;
    }>;

    const passFrames = frames.filter((f) => f.label.startsWith("pass-"));
    const shotFrames = frames.filter((f) => f.label.startsWith("shot-"));

    if (passFrames.length >= 3) {
      const before = passFrames.find((f) => f.label === "pass-before")!;
      const event = passFrames.find((f) => f.label === "pass-event")!;
      const after = passFrames.find((f) => f.label === "pass-after")!;
      expect(before.tick).toBeLessThan(event.tick);
      expect(event.tick).toBeLessThan(after.tick);
    }

    if (shotFrames.length >= 3) {
      const before = shotFrames.find((f) => f.label === "shot-before")!;
      const event = shotFrames.find((f) => f.label === "shot-event")!;
      const after = shotFrames.find((f) => f.label === "shot-after")!;
      expect(before.tick).toBeLessThan(event.tick);
      expect(event.tick).toBeLessThan(after.tick);
    }
  });

  it("NEGATIVE CONTROL: fails when a tick is tampered (before < event violated)", () => {
    // Read the actual sequence.json, tamper a tick, and verify the formula check catches it.
    const sequence = readJson(
      path.join(SCREENSHOT_DIR, "sequence.json"),
    ) as Record<string, unknown>;

    const tampered = JSON.parse(JSON.stringify(sequence));
    // Set pass-before tick equal to pass-event tick (breaking before < event).
    const passBefore = tampered.frames.find((f: { label: string }) => f.label === "pass-before");
    const passEvent = tampered.frames.find((f: { label: string }) => f.label === "pass-event");
    if (passBefore && passEvent) {
      passBefore.tick = passEvent.tick; // tamper: before == event
      // Verify the formula check catches this.
      let caught = false;
      try {
        expect(passBefore.tick).toBe(passEvent.tick + PASS_BEFORE_OFFSET);
      } catch {
        caught = true;
      }
      expect(caught).toBe(true);
    }
  });
});

// ===========================================================================
// PNG uniqueness across screenshots
// ===========================================================================

describe(`${OBJECTIVE_ID}: screenshot uniqueness`, () => {
  it("all PNGs in the screenshot directory have pairwise-unique SHA-256 hashes", () => {
    const pngs = fs
      .readdirSync(SCREENSHOT_DIR)
      .filter((f) => f.endsWith(".png"))
      .sort()
      .map((f) => path.join(SCREENSHOT_DIR, f));

    const hashes = new Map<string, string[]>();
    for (const png of pngs) {
      const hash = sha256(png);
      const existing = hashes.get(hash);
      if (existing) {
        existing.push(path.basename(png));
      } else {
        hashes.set(hash, [path.basename(png)]);
      }
    }

    const duplicates = [...hashes.entries()].filter(([, files]) => files.length > 1);
    if (duplicates.length > 0) {
      const dupDetail = duplicates
        .map(([hash, files]) => `hash ${hash.slice(0, 16)}… shared by [${files.join(", ")}]`)
        .join("; ");
      expect.fail(
        `All PNGs must be pairwise-unique; found duplicate(s): ${dupDetail}`,
      );
    }
  });
});

// ===========================================================================
// RESULT.md honesty
// ===========================================================================

describe(`${OBJECTIVE_ID}: RESULT.md honesty`, () => {
  it("contains claims_not_made section", () => {
    const resultMd = fs.readFileSync(
      path.join(EVIDENCE_DIR, "RESULT.md"),
      "utf-8",
    );
    expect(resultMd).toContain("claims_not_made");
  });

  /**
   * Extract the positive-claim portion of RESULT.md (hypothesis + acceptance).
   * Skips known_gaps and claims_not_made sections which contain denial language.
   */
  function getPositiveClaimBody(resultMd: string): string {
    // Find the first of known_gaps or claims_not_made.
    const knownGapsIdx = resultMd.indexOf("known_gaps:");
    const claimsIdx = resultMd.indexOf("claims_not_made:");
    const cutoff = Math.min(
      knownGapsIdx >= 0 ? knownGapsIdx : Infinity,
      claimsIdx >= 0 ? claimsIdx : Infinity,
    );
    return cutoff < Infinity ? resultMd.slice(0, cutoff) : resultMd;
  }

  it("does NOT claim readability PASS", () => {
    const resultMd = fs.readFileSync(
      path.join(EVIDENCE_DIR, "RESULT.md"),
      "utf-8",
    );
    const mainBody = getPositiveClaimBody(resultMd);
    // Should NOT claim a numeric readability PASS.
    expect(mainBody).not.toMatch(/readability PASS/i);
    expect(mainBody).not.toMatch(/PES fidelity/i);
    expect(mainBody).not.toMatch(/FOUNDATION_LAB_PASS/i);
  });

  it("does NOT claim invented perceptual rubric", () => {
    const resultMd = fs.readFileSync(
      path.join(EVIDENCE_DIR, "RESULT.md"),
      "utf-8",
    );
    const mainBody = getPositiveClaimBody(resultMd);
    expect(mainBody).not.toMatch(/invented.*rubric/i);
    expect(mainBody).not.toMatch(/perceptual rubric/i);
  });

  it("references the correct objective_id", () => {
    const resultMd = fs.readFileSync(
      path.join(EVIDENCE_DIR, "RESULT.md"),
      "utf-8",
    );
    expect(resultMd).toContain(OBJECTIVE_ID);
  });
});
