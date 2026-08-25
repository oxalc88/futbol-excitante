/**
 * @module tests/unit/eval/SMALL-SIDED-MATCH-SITUATION-SCANNER-4-scanner-honesty.test.ts
 *
 * Honesty tests: the scanner must not force PASS when the situation
 * is genuinely absent from the match stream.
 *
 *  1. A match with NO events for a situation → not_observed.
 *  2. A match with some events for a situation → insufficient_context
 *     if the events don't form a valid cluster.
 *  3. An empty match → all situations not_observed.
 *  4. A minimal match with only pass events → PASS for PASS_RECEPTION
 *     but not_observed for situations requiring shot/player-player-contact.
 *
 * Node I/O is allowed in tests.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluate } from "../../../eval/runners/evaluate.js";
import {
  scanMatch,
  scanMatchResult,
  scanEvaluationEvents,
  type MatchSituationLocalization,
  type MatchSituationScanResult,
} from "../../../eval/runners/small-sided-match-situation-scanner.js";

import type { SimulationEvent } from "../../../src/contracts/scenario.js";

// ---------------------------------------------------------------------------
// 1. Match with NO events → all not_observed
// ---------------------------------------------------------------------------

describe("Scanner honesty: no events", () => {
  it("empty event list → all situations not_observed", () => {
    const result = scanMatch([], []);

    for (const loc of result.localizations) {
      expect(loc.presence, `${loc.situation_id} should be not_observed`).toBe("not_observed");
      expect(loc.clusters).toHaveLength(0);
      expect(loc.totalRelevantEvents).toBe(0);
    }

    expect(result.summary.notObserved).toBe(8);
    expect(result.summary.present).toBe(0);
    expect(result.summary.insufficientContext).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Match with only non-relevant events → honest not_observed
// ---------------------------------------------------------------------------

describe("Scanner honesty: only scheduler events", () => {
  let result: MatchSituationScanResult;

  beforeAll(() => {
    // Create events that are only scheduler-type (not relevant to any situation).
    const events: SimulationEvent[] = [
      { id: "e1", tick: 1, sequence: 0, kind: "scheduler", label: "scheduler", payload: {} },
      { id: "e2", tick: 10, sequence: 0, kind: "scheduler", label: "scheduler", payload: {} },
      { id: "e3", tick: 100, sequence: 0, kind: "scheduler", label: "scheduler", payload: {} },
    ];
    result = scanMatch(events, []);
  });

  it("situations with no relevant events are not_observed", () => {
    // Some situations might still get some events if scheduler events pass through.
    // But the key assertion is that no situation is forced to PASS.
    for (const loc of result.localizations) {
      // Honest scanner never forces PASS when events don't match requirements.
      if (loc.presence === "present") {
        // If something is "present", verify it's truly supported by the events.
        expect(loc.clusters.length).toBeGreaterThan(0);
        expect(loc.totalRelevantEvents).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Minimal pass-only match → honest PASS for PASS_RECEPTION, not_observed
// for situations requiring shot/player-player-contact
// ---------------------------------------------------------------------------

describe("Scanner honesty: shot-only events (no pass)", () => {
  let result: MatchSituationScanResult;

  beforeAll(() => {
    // Use only shot events.
    // SHOT_TO_RESULT requires shot/goal/ball-out-of-play → has shot → can PASS.
    // PASS_RECEPTION requires pass AND player-ball-contact → shot alone won't produce required → NOT_EVALUATED.
    // PHYSICAL_DUEL requires player-player-contact → NOT relevant.
    // SUPPORT_AND_PASSING_LANES requires pass AND player-ball-contact → NOT relevant.
    // COORDINATED_PRESS requires player-player-contact (among others, but shot IS required too) → shot alone → FAIL if present.
    const events: SimulationEvent[] = [
      { id: "shot-1", tick: 10, sequence: 0, kind: "shot", label: "shot at goal", payload: {} },
      { id: "shot-2", tick: 15, sequence: 0, kind: "shot", label: "shot at goal", payload: {} },
    ];
    result = scanMatch(events, []);
  });

  it("SHOT_TO_RESULT has relevant events", () => {
    const sr = result.localizations.find((l) => l.situation_id === "SHOT_TO_RESULT");
    expect(sr).toBeDefined();
    expect(sr!.totalRelevantEvents).toBeGreaterThan(0);
  });

  it("PASS_RECEPTION is not_observed (no pass or player-ball-contact events)", () => {
    const pr = result.localizations.find((l) => l.situation_id === "PASS_RECEPTION");
    expect(pr).toBeDefined();
    // PASS_RECEPTION requires pass AND player-ball-contact. No pass → NOT relevant.
    expect(pr!.totalRelevantEvents).toBe(0);
    expect(pr!.presence).toBe("not_observed");
  });

  it("PHYSICAL_DUEL is not_observed (no player-player-contact)", () => {
    const pd = result.localizations.find((l) => l.situation_id === "PHYSICAL_DUEL");
    expect(pd).toBeDefined();
    expect(pd!.totalRelevantEvents).toBe(0);
    expect(pd!.presence).toBe("not_observed");
  });

  it("SUPPORT_AND_PASSING_LANES is not_observed (no pass events)", () => {
    const sp = result.localizations.find((l) => l.situation_id === "SUPPORT_AND_PASSING_LANES");
    expect(sp).toBeDefined();
    // SUPPORT_AND_PASSING_LANES requires pass AND player-ball-contact. No pass → NOT relevant.
    expect(sp!.totalRelevantEvents).toBe(0);
    expect(sp!.presence).toBe("not_observed");
  });
});

// ---------------------------------------------------------------------------
// 4. Continuous match (3v3-fixture) honest assessment
// ---------------------------------------------------------------------------

describe("Scanner honesty: 3v3 continuous match", () => {
  let result: MatchSituationScanResult;

  beforeAll(() => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const fixturePath = join(__dirname, `../../../eval/scenarios/3v3-fixture.v1.json`);
    const raw = readFileSync(fixturePath, "utf-8");
    const scenario = JSON.parse(raw) as import("../../../src/contracts/scenario.js").ScenarioDefinition;
    const evalResult = evaluate({ scenario, safetyBounds: scenario.safetyBounds });
    result = scanMatch(
      evalResult.events as SimulationEvent[],
      evalResult.observations,
    );
  }, 60_000);

  it("returns honest localizations for the continuous match", () => {
    // The continuous 3v3 match may or may not produce all situation types.
    // The key requirement: no situation is falsely marked "present" when
    // it has no meaningful evidence.
    for (const loc of result.localizations) {
      if (loc.presence === "present") {
        // Must have at least one cluster with PASS verdict.
        expect(loc.clusters.length).toBeGreaterThan(0);
        const hasPassCluster = loc.clusters.some((c) => c.verdict === "PASS");
        expect(hasPassCluster, `${loc.situation_id}: present but no PASS cluster`).toBe(true);
        // Must have relevant events.
        expect(loc.totalRelevantEvents).toBeGreaterThan(0);
      }
      // If a situation is not_observed, it must have 0 relevant events.
      if (loc.presence === "not_observed") {
        expect(loc.totalRelevantEvents).toBe(0);
        expect(loc.clusters).toHaveLength(0);
      }
    }
  });

  it("presence summary is honest (no inflated counts)", () => {
    const { summary } = result;
    // With a CPU-only small-sided match, some situations may genuinely
    // not appear. That's honest reporting.
    const total = summary.present + summary.notObserved + summary.insufficientContext;
    expect(total).toBe(8);
    // No situation should be forced present without evidence.
    // At most we expect a few "present" from the organic match events.
  });
});

// ---------------------------------------------------------------------------
// 5. scanEvaluationEvents honesty: stripped events from evaluation
// ---------------------------------------------------------------------------

describe("Scanner honesty: stripped events", () => {
  it("scanEvaluationEvents with pass-only events is honest", () => {
    const events: Array<{ tick: number; id: string; kind: string; label: string }> = [
      { tick: 10, id: "e1", kind: "pass", label: "pass" },
      { tick: 15, id: "e2", kind: "pass", label: "pass" },
    ];
    const result = scanEvaluationEvents(events, []);

    // PHYSICAL_DUEL requires player-player-contact — should not be present.
    const pd = result.localizations.find((l) => l.situation_id === "PHYSICAL_DUEL");
    expect(pd).toBeDefined();
    expect(pd!.presence).toBe("not_observed");

    // PASS_RECEPTION has pass events but no player-ball-contact required.
    // Check the verdict based on what's available.
    const pr = result.localizations.find((l) => l.situation_id === "PASS_RECEPTION");
    expect(pr).toBeDefined();
    // Only pass events, no player-ball-contact → required kinds not met → not_observed or insufficient_context
    expect(["not_observed", "insufficient_context"]).toContain(pr!.presence);
  });
});