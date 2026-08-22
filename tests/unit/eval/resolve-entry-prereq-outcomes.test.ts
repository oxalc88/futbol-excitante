/**
 * @module tests/unit/eval/resolve-entry-prereq-outcomes
 *
 * Tests for `resolveEntryPrereqOutcomes` from the playable-1v1-profile-runner.
 *
 * Verifies that the resolver reads eval.json (not manifest.json + audit.json)
 * and that Gauntlet audit PASS does not become a milestone PASS.
 *
 * Node I/O is allowed in tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

import { resolveEntryPrereqOutcomes } from "../../../eval/runners/playable-1v1-profile-runner.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PREREQS = ["FOUNDATION_LAB_PASS", "CAPABILITY_DESIGN_PROFILE"];

function mkTempDir(): string {
  return mkdtempSync(join(tmpdir(), "resolver-test-"));
}

function writeEvalJson(dir: string, prereq: string, data: Record<string, unknown>): void {
  const dirPath = join(dir, prereq);
  mkdirSync(dirPath, { recursive: true });
  writeFileSync(join(dirPath, "eval.json"), JSON.stringify(data), "utf-8");
}

function writeManifestAudit(dir: string, prereq: string, accepted: boolean, verdict: string): void {
  const dirPath = join(dir, prereq);
  mkdirSync(dirPath, { recursive: true });
  writeFileSync(join(dirPath, "manifest.json"), JSON.stringify({ accepted }), "utf-8");
  writeFileSync(join(dirPath, "audit.json"), JSON.stringify({ verdict }), "utf-8");
}

// ---------------------------------------------------------------------------
// 1. Missing eval.json → key omitted / caller defaults to BLOCKED_MISSING_REFERENCE
// ---------------------------------------------------------------------------

describe("resolveEntryPrereqOutcomes: missing eval.json", () => {
  it("omits key when evidence dir does not exist", () => {
    const tmp = mkTempDir();
    try {
      const result = resolveEntryPrereqOutcomes(PREREQS, tmp);
      expect(Object.keys(result)).toHaveLength(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("omits key when eval.json is missing but dir exists", () => {
    const tmp = mkTempDir();
    try {
      // Create dir but no eval.json
      mkdirSync(join(tmp, "FOUNDATION_LAB_PASS"), { recursive: true });
      const result = resolveEntryPrereqOutcomes(PREREQS, tmp);
      expect(result).not.toHaveProperty("FOUNDATION_LAB_PASS");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("omits key when eval.json is unreadable / invalid JSON", () => {
    const tmp = mkTempDir();
    try {
      const dirPath = join(tmp, "CAPABILITY_DESIGN_PROFILE");
      mkdirSync(dirPath, { recursive: true });
      writeFileSync(join(dirPath, "eval.json"), "NOT JSON", "utf-8");
      const result = resolveEntryPrereqOutcomes(PREREQS, tmp);
      expect(result).not.toHaveProperty("CAPABILITY_DESIGN_PROFILE");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("omits key when eval.json lacks milestoneVerdict and overall", () => {
    const tmp = mkTempDir();
    try {
      writeEvalJson(tmp, "FOUNDATION_LAB_PASS", { someOtherField: "value" });
      const result = resolveEntryPrereqOutcomes(PREREQS, tmp);
      expect(result).not.toHaveProperty("FOUNDATION_LAB_PASS");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 2. eval.json verdict passthrough
// ---------------------------------------------------------------------------

describe("resolveEntryPrereqOutcomes: verdict passthrough", () => {
  it("PASS via milestoneVerdict", () => {
    const tmp = mkTempDir();
    try {
      writeEvalJson(tmp, "FOUNDATION_LAB_PASS", { milestoneVerdict: "PASS" });
      const result = resolveEntryPrereqOutcomes(PREREQS, tmp);
      expect(result["FOUNDATION_LAB_PASS"]).toBe("PASS");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("PASS via overall (fallback when milestoneVerdict absent)", () => {
    const tmp = mkTempDir();
    try {
      writeEvalJson(tmp, "CAPABILITY_DESIGN_PROFILE", { overall: "PASS" });
      const result = resolveEntryPrereqOutcomes(PREREQS, tmp);
      expect(result["CAPABILITY_DESIGN_PROFILE"]).toBe("PASS");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("milestoneVerdict takes precedence over overall", () => {
    const tmp = mkTempDir();
    try {
      writeEvalJson(tmp, "FOUNDATION_LAB_PASS", {
        milestoneVerdict: "PASS",
        overall: "FAIL",
      });
      const result = resolveEntryPrereqOutcomes(PREREQS, tmp);
      expect(result["FOUNDATION_LAB_PASS"]).toBe("PASS");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("FAIL passes through", () => {
    const tmp = mkTempDir();
    try {
      writeEvalJson(tmp, "FOUNDATION_LAB_PASS", { milestoneVerdict: "FAIL" });
      const result = resolveEntryPrereqOutcomes(PREREQS, tmp);
      expect(result["FOUNDATION_LAB_PASS"]).toBe("FAIL");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("NEEDS_PERCEPTUAL_REVIEW passes through", () => {
    const tmp = mkTempDir();
    try {
      writeEvalJson(tmp, "FOUNDATION_LAB_PASS", { milestoneVerdict: "NEEDS_PERCEPTUAL_REVIEW" });
      const result = resolveEntryPrereqOutcomes(PREREQS, tmp);
      expect(result["FOUNDATION_LAB_PASS"]).toBe("NEEDS_PERCEPTUAL_REVIEW");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("NOT_EVALUATED passes through", () => {
    const tmp = mkTempDir();
    try {
      writeEvalJson(tmp, "FOUNDATION_LAB_PASS", { milestoneVerdict: "NOT_EVALUATED" });
      const result = resolveEntryPrereqOutcomes(PREREQS, tmp);
      expect(result["FOUNDATION_LAB_PASS"]).toBe("NOT_EVALUATED");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("INVALID_RUN passes through", () => {
    const tmp = mkTempDir();
    try {
      writeEvalJson(tmp, "FOUNDATION_LAB_PASS", { milestoneVerdict: "INVALID_RUN" });
      const result = resolveEntryPrereqOutcomes(PREREQS, tmp);
      expect(result["FOUNDATION_LAB_PASS"]).toBe("INVALID_RUN");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("BLOCKED_MISSING_REFERENCE passes through", () => {
    const tmp = mkTempDir();
    try {
      writeEvalJson(tmp, "FOUNDATION_LAB_PASS", { milestoneVerdict: "BLOCKED_MISSING_REFERENCE" });
      const result = resolveEntryPrereqOutcomes(PREREQS, tmp);
      expect(result["FOUNDATION_LAB_PASS"]).toBe("BLOCKED_MISSING_REFERENCE");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Gauntlet audit PASS + accepted manifest WITHOUT eval.json does NOT yield PASS
// ---------------------------------------------------------------------------

describe("resolveEntryPrereqOutcomes: Gauntlet audit must NOT produce milestone PASS", () => {
  it("manifest.accepted=true + audit.verdict=PASS without eval.json → key omitted", () => {
    const tmp = mkTempDir();
    try {
      // Write only manifest.json and audit.json (old evidence format)
      writeManifestAudit(tmp, "FOUNDATION_LAB_PASS", true, "PASS");
      const result = resolveEntryPrereqOutcomes(PREREQS, tmp);
      // Must NOT contain FOUNDATION_LAB_PASS — no eval.json present.
      expect(result).not.toHaveProperty("FOUNDATION_LAB_PASS");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("even with manifest audit PASS and valid eval.json for another prereq, the one with only audit remains omitted", () => {
    const tmp = mkTempDir();
    try {
      // First prereq: only manifest + audit (no eval.json)
      writeManifestAudit(tmp, "FOUNDATION_LAB_PASS", true, "PASS");
      // Second prereq: has eval.json with PASS
      writeEvalJson(tmp, "CAPABILITY_DESIGN_PROFILE", { milestoneVerdict: "PASS" });
      const result = resolveEntryPrereqOutcomes(PREREQS, tmp);
      expect(result).not.toHaveProperty("FOUNDATION_LAB_PASS");
      expect(result["CAPABILITY_DESIGN_PROFILE"]).toBe("PASS");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("Gauntlet audit PASS with eval.json that has FAIL → FAIL, not PASS", () => {
    const tmp = mkTempDir();
    try {
      writeManifestAudit(tmp, "FOUNDATION_LAB_PASS", true, "PASS");
      writeEvalJson(tmp, "FOUNDATION_LAB_PASS", { milestoneVerdict: "FAIL" });
      const result = resolveEntryPrereqOutcomes(PREREQS, tmp);
      // eval.json takes precedence; audit PASS must not win.
      expect(result["FOUNDATION_LAB_PASS"]).toBe("FAIL");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Unknown/unusable verdict does NOT yield PASS
// ---------------------------------------------------------------------------

describe("resolveEntryPrereqOutcomes: unknown verdict handling", () => {
  it("unknown verdict string is omitted", () => {
    const tmp = mkTempDir();
    try {
      writeEvalJson(tmp, "FOUNDATION_LAB_PASS", { milestoneVerdict: "SUPER_PASS" });
      const result = resolveEntryPrereqOutcomes(PREREQS, tmp);
      expect(result).not.toHaveProperty("FOUNDATION_LAB_PASS");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("null milestoneVerdict is omitted", () => {
    const tmp = mkTempDir();
    try {
      writeEvalJson(tmp, "FOUNDATION_LAB_PASS", { milestoneVerdict: null });
      const result = resolveEntryPrereqOutcomes(PREREQS, tmp);
      expect(result).not.toHaveProperty("FOUNDATION_LAB_PASS");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("numeric milestoneVerdict is omitted (not a string)", () => {
    const tmp = mkTempDir();
    try {
      writeEvalJson(tmp, "FOUNDATION_LAB_PASS", { milestoneVerdict: 42 });
      const result = resolveEntryPrereqOutcomes(PREREQS, tmp);
      expect(result).not.toHaveProperty("FOUNDATION_LAB_PASS");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("numeric overall is also omitted", () => {
    const tmp = mkTempDir();
    try {
      writeEvalJson(tmp, "CAPABILITY_DESIGN_PROFILE", { overall: 0 });
      const result = resolveEntryPrereqOutcomes(PREREQS, tmp);
      expect(result).not.toHaveProperty("CAPABILITY_DESIGN_PROFILE");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Multiple prerequisites
// ---------------------------------------------------------------------------

describe("resolveEntryPrereqOutcomes: multiple prerequisites", () => {
  it("resolves both prereqs when both have eval.json", () => {
    const tmp = mkTempDir();
    try {
      writeEvalJson(tmp, "FOUNDATION_LAB_PASS", { milestoneVerdict: "PASS" });
      writeEvalJson(tmp, "CAPABILITY_DESIGN_PROFILE", { milestoneVerdict: "FAIL" });
      const result = resolveEntryPrereqOutcomes(PREREQS, tmp);
      expect(result["FOUNDATION_LAB_PASS"]).toBe("PASS");
      expect(result["CAPABILITY_DESIGN_PROFILE"]).toBe("FAIL");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns partial map when only some prereqs have eval.json", () => {
    const tmp = mkTempDir();
    try {
      writeEvalJson(tmp, "FOUNDATION_LAB_PASS", { milestoneVerdict: "PASS" });
      // CAPABILITY_DESIGN_PROFILE has no dir at all
      const result = resolveEntryPrereqOutcomes(PREREQS, tmp);
      expect(result["FOUNDATION_LAB_PASS"]).toBe("PASS");
      expect(result).not.toHaveProperty("CAPABILITY_DESIGN_PROFILE");
      // Total keys == 1, not 2.
      expect(Object.keys(result)).toHaveLength(1);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Default evidenceBase (no explicit argument)
// ---------------------------------------------------------------------------

describe("resolveEntryPrereqOutcomes: default evidenceBase", () => {
  it("defaults to docs/evidence relative to module when no arg provided", () => {
    // When no evidenceBase is given, the function reads from the
    // durable docs/evidence path. FOUNDATION_LAB_PASS/eval.json is produced
    // by foundation-lab-eval-runner and CAPABILITY_DESIGN_PROFILE/eval.json
    // is produced by capability-design-eval-runner, so both resolve.
    const result = resolveEntryPrereqOutcomes(PREREQS);
    expect(result).toHaveProperty("FOUNDATION_LAB_PASS");
    expect(result["FOUNDATION_LAB_PASS"]).toBe("PASS");
    // CAPABILITY_DESIGN_PROFILE/eval.json now exists → resolved.
    expect(result).toHaveProperty("CAPABILITY_DESIGN_PROFILE");
  });
});

// ---------------------------------------------------------------------------
// 7. Caller-defaults-to-BLOCKED_MISSING_REFERENCE invariant
// ---------------------------------------------------------------------------

describe("resolveEntryPrereqOutcomes: caller defaults to BLOCKED_MISSING_REFERENCE", () => {
  it("omitted key in resolver map means caller uses BLOCKED_MISSING_REFERENCE", () => {
    const tmp = mkTempDir();
    try {
      writeEvalJson(tmp, "FOUNDATION_LAB_PASS", { milestoneVerdict: "PASS" });
      const result = resolveEntryPrereqOutcomes(PREREQS, tmp);

      // FOUNDATION_LAB_PASS is resolved (PASS)
      expect(result["FOUNDATION_LAB_PASS"]).toBe("PASS");

      // CAPABILITY_DESIGN_PROFILE is NOT in the map → caller must treat it
      // as BLOCKED_MISSING_REFERENCE (not NOT_EVALUATED, not anything else).
      expect(Object.hasOwn(result, "CAPABILITY_DESIGN_PROFILE")).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});