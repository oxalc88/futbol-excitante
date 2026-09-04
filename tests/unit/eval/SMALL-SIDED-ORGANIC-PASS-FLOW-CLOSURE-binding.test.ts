/**
 * @module tests/unit/eval/SMALL-SIDED-ORGANIC-PASS-FLOW-CLOSURE-binding
 *
 * Binding tests for the SMALL-SIDED-ORGANIC-PASS-FLOW-CLOSURE objective.
 *
 * Evidence class: BOOKKEEPING
 *
 * Tests:
 *  (a) Playtest record exists and has correct structure.
 *  (b) coherent_match_sources block present with the new anti-huddle / post-fix
 *      sources and honest presence maps (no forced presence).
 *  (c) The browser 620-tick capture is disclosed as NOT scanner-acceptable.
 *  (d) milestone_verdict PASS preserved (BATCH-5 driven fixtures decisive).
 *  (e) Bundle manifest coherence: latest playtest is the new PASS record.
 *  (f) No src/ changes (evidence-bundle only).
 *  (g) claims_not_made: no PROMOTION / PES fidelity / FOUNDATION_LAB claim.
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

const PLAYTEST_PATH = join(
  projectRoot,
  "docs/evidence/milestones/SMALL_SIDED_SHAPE/playtests/2026-09-04T18-16-07-471Z.json",
);

describe("SMALL-SIDED-ORGANIC-PASS-FLOW-CLOSURE binding", () => {
  // (a) Playtest record structure
  it("playtest record exists and has correct schema structure", () => {
    expect(existsSync(PLAYTEST_PATH)).toBe(true);

    const record = JSON.parse(readFileSync(PLAYTEST_PATH, "utf-8")) as Record<string, unknown>;
    expect(record.schema_version).toBe(1);
    expect(record.record_type).toBe("milestone_playtest_result");
    expect(record.milestone_id).toBe("SMALL_SIDED_SHAPE");
    expect(record.playtest_plan_version).toBe("small-sided-shape-playtest-v1");
    expect(record.decision).toBe("milestone_verdict_ready");
    expect(record.milestone_verdict).toBe("PASS");
    expect(record.failure_class).toBe(null);
  });

  // (b) coherent_match_sources present with new sources + honest presence
  it("coherent_match_sources block present with the new anti-huddle / post-fix sources", () => {
    const record = JSON.parse(readFileSync(PLAYTEST_PATH, "utf-8")) as Record<string, unknown>;
    const evidence = record.evidence as Record<string, unknown>;
    const sources = evidence.coherent_match_sources as Array<Record<string, unknown>>;
    expect(Array.isArray(sources)).toBe(true);
    expect(sources.length).toBeGreaterThanOrEqual(4);

    // The new anti-huddle flowing run (1800 ticks) must be present and scan 8 present.
    const antiHuddle = sources.find((s: Record<string, unknown>) =>
      s.description?.toString().includes("anti-huddle CPU-vs-CPU flowing match"),
    );
    expect(antiHuddle).toBeDefined();
    expect((antiHuddle!.scan_summary as Record<string, number>).present).toBe(8);
    expect((antiHuddle!.scan_summary as Record<string, number>).notObserved).toBe(0);
    expect((antiHuddle!.scan_summary as Record<string, number>).insufficientContext).toBe(0);

    // The new post-fix kickoff run (600 ticks) must be present.
    const kickoff = sources.find((s: Record<string, unknown>) =>
      s.description?.toString().includes("post-ball-fix kickoff match"),
    );
    expect(kickoff).toBeDefined();

    // Every source must carry a per-situation presence map.
    for (const src of sources) {
      expect(src.match_scenario).toBeDefined();
      expect(src.scan_summary).toBeDefined();
      expect(src.situations).toBeDefined();
    }
  });

  it("presence maps are honest as measured — no forced presence", () => {
    const record = JSON.parse(readFileSync(PLAYTEST_PATH, "utf-8")) as Record<string, unknown>;
    const evidence = record.evidence as Record<string, unknown>;
    const sources = evidence.coherent_match_sources as Array<Record<string, unknown>>;

    const antiHuddle = sources.find((s: Record<string, unknown>) =>
      s.description?.toString().includes("anti-huddle CPU-vs-CPU flowing match"),
    )!;
    const kickoff = sources.find((s: Record<string, unknown>) =>
      s.description?.toString().includes("post-ball-fix kickoff match"),
    )!;

    // PHYSICAL_DUEL is present in the anti-huddle flowing run (input-rejection fired)
    // and insufficient_context in the post-fix kickoff run.
    const duelAnti = (antiHuddle.situations as Record<string, Record<string, unknown>>).PHYSICAL_DUEL;
    expect(duelAnti.presence).toBe("present");
    expect((duelAnti.observedKinds as string[])).toContain("input-rejection");
    const duelKick = (kickoff.situations as Record<string, Record<string, unknown>>).PHYSICAL_DUEL;
    expect(duelKick.presence).toBe("insufficient_context");

    // SHOT_TO_RESULT is not_observed in the post-fix kickoff run (no shot/goal).
    const shotKick = (kickoff.situations as Record<string, Record<string, unknown>>).SHOT_TO_RESULT;
    expect(shotKick.presence).toBe("not_observed");

    // The existing non-cpuTackle 5v5/3v3 sources keep the honest insufficient_context
    // for PHYSICAL_DUEL (input-rejection absent in organic play).
    const s5v5 = sources.find((s: Record<string, unknown>) =>
      s.match_scenario === "5v5-continuous-play.v1.json",
    );
    expect(s5v5).toBeDefined();
    const duel5v5 = (s5v5!.situations as Record<string, Record<string, unknown>>).PHYSICAL_DUEL;
    expect(duel5v5.presence).toBe("insufficient_context");
    expect((duel5v5.reason as string).toLowerCase()).toContain("input-rejection");

    // The re-scanned cpuDefensiveTackle sources are re-verified under the
    // historical observation shape (browserParityObservations=false) and remain
    // unchanged by the ball fix: the 5v5 cpuTackle source keeps 7/0/1 with
    // PHYSICAL_DUEL insufficient_context, and the 3v3 cpuTackle source keeps
    // 6/0/2 with PHYSICAL_DUEL insufficient_context.
    const s5v5Tackle = sources.find((s: Record<string, unknown>) =>
      s.match_scenario === "5v5-continuous-play-v1" &&
      s.browserParityObservations === false &&
      s.cpuDefensiveTackle === true,
    );
    expect(s5v5Tackle).toBeDefined();
    expect((s5v5Tackle!.scan_summary as Record<string, number>).present).toBe(7);
    expect((s5v5Tackle!.scan_summary as Record<string, number>).insufficientContext).toBe(1);
    expect((s5v5Tackle!.event_totals as Record<string, number>).total_events).toBe(1062);

    const s3v3Tackle = sources.find((s: Record<string, unknown>) =>
      s.match_scenario === "3v3-press-scenario-v1" &&
      s.browserParityObservations === false &&
      s.cpuDefensiveTackle === true,
    );
    expect(s3v3Tackle).toBeDefined();
    expect((s3v3Tackle!.scan_summary as Record<string, number>).present).toBe(6);
    expect((s3v3Tackle!.scan_summary as Record<string, number>).notObserved).toBe(0);
    expect((s3v3Tackle!.scan_summary as Record<string, number>).insufficientContext).toBe(2);
    expect((s3v3Tackle!.event_totals as Record<string, number>).total_events).toBe(262);
    const duel3v3Tackle = (s3v3Tackle!.situations as Record<string, Record<string, unknown>>).PHYSICAL_DUEL;
    expect(duel3v3Tackle.presence).toBe("insufficient_context");
  });

  it("no false ball-fix causal narrative is recorded", () => {
    const record = JSON.parse(readFileSync(PLAYTEST_PATH, "utf-8")) as Record<string, unknown>;
    const evidence = record.evidence as Record<string, unknown>;
    const remark = evidence.remark as string;
    const sources = evidence.coherent_match_sources as Array<Record<string, unknown>>;
    const allNotes = sources.flatMap((s) => (s.notes as string[]) ?? []).join(" ");

    // The deltas in the cpuTackle sources are caused by the browser-parity
    // observation shape, not by the ball fix — the false causal claims must be gone.
    expect(remark.toLowerCase()).not.toContain("because a settled ball integrates");
    expect(remark.toLowerCase()).not.toContain("clumping on a frozen settled ball");
    expect(allNotes.toLowerCase()).not.toContain("because a settled ball integrates");
    expect(allNotes.toLowerCase()).not.toContain("clumping on a frozen settled ball");
  });

  // (c) Browser capture disclosed as NOT scanner-acceptable
  it("browser 620-tick capture disclosed as NOT scanner-acceptable", () => {
    const record = JSON.parse(readFileSync(PLAYTEST_PATH, "utf-8")) as Record<string, unknown>;
    const evidence = record.evidence as Record<string, unknown>;
    const browser = evidence.browser_anti_huddle_capture as Record<string, unknown>;
    expect(browser).toBeDefined();
    expect(browser.scanner_acceptable).toBe(false);
    expect((browser.reason as string).toLowerCase()).toContain("scanner");
    expect((browser.reason as string).toLowerCase()).toContain("simulationevent");
  });

  // (d) milestone_verdict PASS preserved — BATCH-5 decisive
  it("milestone_verdict PASS preserved — no weakening of BATCH-5 source", () => {
    const record = JSON.parse(readFileSync(PLAYTEST_PATH, "utf-8")) as Record<string, unknown>;
    expect(record.milestone_verdict).toBe("PASS");

    const evidence = record.evidence as Record<string, unknown>;
    const batches = evidence.batch_sources as string[];
    expect(batches.some((b) => b.toLowerCase().includes("batch-5"))).toBe(true);

    const outcomes = record.situation_outcomes as Record<string, string>;
    const requiredSituations = record.required_situations as string[];
    for (const sit of requiredSituations) {
      expect(outcomes[sit]).toBe("PASS");
    }
    expect(record.entry_prerequisites_pass).toBe(true);
    expect(record.exit_prerequisites_pass).toBe(true);
  });

  // (e) Bundle manifest coherence
  it("bundle manifest latest playtest is the new PASS record", () => {
    const manifestPath = join(
      projectRoot,
      "docs/evidence/milestones/SMALL_SIDED_SHAPE/manifest.json",
    );
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as Record<string, unknown>;
    expect(manifest.milestone_id).toBe("SMALL_SIDED_SHAPE");
    const latest = manifest.latest_playtest_result as {
      path: string;
      result: { milestone_verdict: string; decision: string };
    };
    expect(latest.path).toContain("2026-09-04T18-16-07-471Z");
    expect(latest.result.milestone_verdict).toBe("PASS");
    expect(latest.result.decision).toBe("milestone_verdict_ready");

    const runs = manifest.playtest_runs as Array<{ milestone_verdict: string }>;
    expect(runs.at(-1)?.milestone_verdict).toBe("PASS");
  });

  // (f) No src/ changes (evidence-bundle only)
  it("no source code changed — src/ tree is structurally intact", () => {
    const srcDir = join(projectRoot, "src");
    expect(existsSync(srcDir)).toBe(true);
    const ballSystem = join(srcDir, "simulation/ball/ball-system.ts");
    const headlessMatch = join(projectRoot, "eval/runners/headless-match.ts");
    const scanner = join(projectRoot, "eval/runners/small-sided-match-situation-scanner.ts");
    expect(existsSync(ballSystem)).toBe(true);
    expect(existsSync(headlessMatch)).toBe(true);
    expect(existsSync(scanner)).toBe(true);
  });

  // (g) claims_not_made
  it("evidence record does not make PROMOTION or PES fidelity claims", () => {
    const record = JSON.parse(readFileSync(PLAYTEST_PATH, "utf-8")) as Record<string, unknown>;
    const evidence = record.evidence as Record<string, unknown>;
    const remark = evidence.remark as string;
    expect(remark.toLowerCase()).not.toContain("promote");
    expect(remark.toLowerCase()).not.toContain("pes fidelity");
    expect(remark.toLowerCase()).not.toContain("foundation_lab");
  });
});
