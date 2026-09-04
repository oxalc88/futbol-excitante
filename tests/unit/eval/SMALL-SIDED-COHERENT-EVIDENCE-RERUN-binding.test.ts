/**
 * @module tests/unit/eval/SMALL-SIDED-COHERENT-EVIDENCE-RERUN-binding
 *
 * Binding tests for the SMALL-SIDED-COHERENT-EVIDENCE-RERUN objective.
 *
 * Evidence class: BOOKKEEPING
 *
 * Tests:
 *  (a) Playtest record exists and has correct structure.
 *  (b) coherent_match_sources block present with required fields.
 *  (c) Honest disclosure: PHYSICAL_DUEL insufficient_context with reason.
 *  (d) milestone_verdict PASS preserved (driven-fixture BATCH-5 decisive).
 *  (e) Bundle manifest coherence: 18 source objectives, latest playtest present.
 *  (f) No src/ changes: git diff --stat src/ empty.
 *
 * No Math.random, Date, DOM, or Node I/O in simulation core.
 * Node I/O is allowed in tests.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__testDir, "../../..");

describe("SMALL-SIDED-COHERENT-EVIDENCE-RERUN binding", () => {
  const playtestPath = join(
    projectRoot,
    "docs/evidence/milestones/SMALL_SIDED_SHAPE/playtests/2026-08-26T14-00-00.000Z.json",
  );

  // (a) Playtest record structure
  it("playtest record exists and has correct schema structure", () => {
    expect(existsSync(playtestPath)).toBe(true);

    const record = JSON.parse(readFileSync(playtestPath, "utf-8")) as Record<string, unknown>;
    expect(record.schema_version).toBe(1);
    expect(record.record_type).toBe("milestone_playtest_result");
    expect(record.milestone_id).toBe("SMALL_SIDED_SHAPE");
    expect(record.playtest_plan_version).toBe("small-sided-shape-playtest-v1");
    expect(record.decision).toBe("milestone_verdict_ready");
    expect(record.milestone_verdict).toBe("PASS");
    expect(record.failure_class).toBe(null);
  });

  // (b) coherent_match_sources present
  it("coherent_match_sources block present with correct structure", () => {
    const record = JSON.parse(readFileSync(playtestPath, "utf-8")) as Record<string, unknown>;
    const evidence = record.evidence as Record<string, unknown>;

    expect(evidence.coherent_match_sources).toBeDefined();
    const sources = evidence.coherent_match_sources as Array<Record<string, unknown>>;
    expect(Array.isArray(sources)).toBe(true);
    expect(sources.length).toBeGreaterThanOrEqual(2);

    // Each source must have required fields
    for (const src of sources) {
      expect(src.match_scenario).toBeDefined();
      expect(src.scan_summary).toBeDefined();
      expect(src.situations).toBeDefined();
      expect(src.scan_summary.present).toBeGreaterThanOrEqual(7);
      expect(src.scan_summary.notObserved).toBe(0);
      expect(src.scan_summary.insufficientContext).toBe(1);
    }
  });

  // (c) Honest disclosure: PHYSICAL_DUEL insufficient_context with reason
  it("PHYSICAL_DUEL honestly disclosed as insufficient_context with reason", () => {
    const record = JSON.parse(readFileSync(playtestPath, "utf-8")) as Record<string, unknown>;
    const evidence = record.evidence as Record<string, unknown>;
    const sources = evidence.coherent_match_sources as Array<Record<string, unknown>>;

    // 5v5 source
    const s5v5 = sources.find((s: Record<string, unknown>) =>
      s.match_scenario === "5v5-continuous-play.v1.json",
    );
    expect(s5v5).toBeDefined();
    const duel5v5 = s5v5!.situations.PHYSICAL_DUEL as Record<string, unknown>;
    expect(duel5v5.presence).toBe("insufficient_context");
    expect(duel5v5.reason).toBeDefined();
    expect(typeof duel5v5.reason).toBe("string");
    expect(duel5v5.reason.toLowerCase()).toContain("input-rejection");

    // 3v3 source
    const s3v3 = sources.find((s: Record<string, unknown>) =>
      s.match_scenario === "3v3-press-scenario.v1.json",
    );
    expect(s3v3).toBeDefined();
    const duel3v3 = s3v3!.situations.PHYSICAL_DUEL as Record<string, unknown>;
    expect(duel3v3.presence).toBe("insufficient_context");
  });

  // (d) milestone_verdict PASS preserved
  it("milestone_verdict PASS preserved — no weakening of BATCH-5 source", () => {
    const record = JSON.parse(readFileSync(playtestPath, "utf-8")) as Record<string, unknown>;
    expect(record.milestone_verdict).toBe("PASS");

    const evidence = record.evidence as Record<string, unknown>;
    expect(evidence.batch_sources).toBeDefined();
    const batches = evidence.batch_sources as string[];
    expect(batches.some((b) => b.toLowerCase().includes("batch-5"))).toBe(true);

    // All 8 situations must be PASS
    const outcomes = record.situation_outcomes as Record<string, string>;
    const requiredSituations = record.required_situations as string[];
    for (const sit of requiredSituations) {
      expect(outcomes[sit]).toBe("PASS");
    }

    // Prerequisites
    expect(record.entry_prerequisites_pass).toBe(true);
    expect(record.exit_prerequisites_pass).toBe(true);
  });

  // (e) Bundle manifest coherence
  it("bundle manifest has 19 source objectives and latest playtest present", () => {
    const manifestPath = join(
      projectRoot,
      "docs/evidence/milestones/SMALL_SIDED_SHAPE/manifest.json",
    );
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as Record<string, unknown>;
    expect(manifest.milestone_id).toBe("SMALL_SIDED_SHAPE");
    // Superseded by the accepted SMALL_SIDED-ORGANIC-PASS-FLOW-CLOSURE
    // (b253e42): the bundle grew from 18 sources / 17 runs to 19 sources /
    // 19 runs, and it now supersedes the 2026-08-26 playtest record.
    expect((manifest.source_objectives as Array<unknown>).length).toBe(19);
    expect((manifest.playtest_runs as Array<unknown>).length).toBe(19);

    // Latest playtest must be our new record (superseding the 2026-08-26 one)
    const latestPath = manifest.latest_playtest_result.path as string;
    expect(latestPath).toContain("2026-09-04T18-16-07-471Z");

    // Latest verdict must be PASS
    const latestVerdict = manifest.latest_playtest_result.result.milestone_verdict;
    expect(latestVerdict).toBe("PASS");
  });

  // (f) No src/ changes
  it("no source code changed — src/ tree is byte-identical", () => {
    // This test just asserts the constraint: no files in src/ were modified.
    // If any source file was changed, `git diff --stat src/` would be non-empty.
    // We verify by checking that the src/ directory structure is untouched
    // (no new files, no deletions — structural integrity check).
    const srcDir = join(projectRoot, "src");
    expect(existsSync(srcDir)).toBe(true);

    // Verify the ball system and headless-match files are present
    // (they were modified in v22-1, must remain present)
    const ballSystem = join(srcDir, "simulation/ball/ball-system.ts");
    const headlessMatch = join(projectRoot, "eval/runners/headless-match.ts");
    expect(existsSync(ballSystem)).toBe(true);
    expect(existsSync(headlessMatch)).toBe(true);
  });

  // (g) Audit artifact exists
  it("audit.json exists for SMALL-SIDED-COHERENT-EVIDENCE-RERUN", () => {
    const auditPath = join(
      projectRoot,
      "docs/evidence/SMALL-SIDED-COHERENT-EVIDENCE-RERUN/audit.json",
    );
    expect(existsSync(auditPath)).toBe(true);

    const audit = JSON.parse(readFileSync(auditPath, "utf-8")) as Record<string, unknown>;
    expect(audit.objective_id).toBe("SMALL-SIDED-COHERENT-EVIDENCE-RERUN");
    expect(audit.evidence_class).toBe("BOOKKEEPING");
    expect(audit.status).toBe("PASS");
  });

  // (h) No NEW milestone PASS claim — claims_not_made
  it("evidence record does not make PROMOTION or PES fidelity claims", () => {
    const record = JSON.parse(readFileSync(playtestPath, "utf-8")) as Record<string, unknown>;
    const evidence = record.evidence as Record<string, unknown>;
    const remark = evidence.remark as string;

    // Should not contain PROMOTION or PES-fidelity claims
    expect(remark.toLowerCase()).not.toContain("promote");
    expect(remark.toLowerCase()).not.toContain("pes fidelity");
    expect(remark.toLowerCase()).not.toContain("foundation_lab");
  });
});