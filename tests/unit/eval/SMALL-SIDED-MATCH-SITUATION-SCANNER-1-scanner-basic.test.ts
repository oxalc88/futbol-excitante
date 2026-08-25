/**
 * @module tests/unit/eval/SMALL-SIDED-MATCH-SITUATION-SCANNER-1-scanner-basic.test.ts
 *
 * Tests for the match situation scanner — basic functionality:
 *   1. Scanner runs over a continuous match (3v3-fixture.v1.json via evaluate)
 *      and returns localizations for all 8 situations.
 *   2. Each localization has the correct shape and fields.
 *   3. Summary counts are consistent.
 *   4. scanMatchResult (headless-match events variant) works.
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
  type MatchSituationCluster,
  type MatchSituationScanResult,
} from "../../../eval/runners/small-sided-match-situation-scanner.js";

import {
  MAPPED_SITUATION_IDS,
  getSituationEvidence,
} from "../../../eval/contracts/situation-mapping.js";

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): import("../../../src/contracts/scenario.js").ScenarioDefinition {
  const fixturePath = join(__dirname, `../../../eval/scenarios/${name}`);
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as import("../../../src/contracts/scenario.js").ScenarioDefinition;
}

// ---------------------------------------------------------------------------
// 1. Scanner runs over continuous match and returns all 8 localizations
// ---------------------------------------------------------------------------

describe("Scanner: basic — continuous match 3v3", () => {
  let events: Array<{ tick: number; id: string; kind: string; label: string }>;
  let observations: import("../../../src/contracts/telemetry.js").TelemetryObservation[];
  let result: MatchSituationScanResult;

  beforeAll(() => {
    // Use the shorter 5v5 fixture (600 ticks) for speed. 3v3 (5400 ticks)
    // is tested in determinism and backward-compat test files.
    const scenario = loadFixture("5v5-fixture-v1.json");
    const evalResult = evaluate({ scenario, safetyBounds: scenario.safetyBounds });
    events = evalResult.events;
    observations = evalResult.observations;

    result = scanMatch(
      events as import("../../../src/contracts/scenario.js").SimulationEvent[],
      observations,
    );
  }, 60_000);

  it("returns localizations for all 8 MAPPED_SITUATION_IDS", () => {
    const locIds = new Set(result.localizations.map((l) => l.situation_id));
    for (const sitId of MAPPED_SITUATION_IDS) {
      expect(locIds.has(sitId), `Missing localization for ${sitId}`).toBe(true);
    }
    expect(locIds.size).toBe(MAPPED_SITUATION_IDS.length);
  });

  it("has 8 total localizations", () => {
    expect(result.localizations.length).toBe(MAPPED_SITUATION_IDS.length);
  });

  it("totalTicks is positive", () => {
    expect(result.totalTicks).toBeGreaterThan(0);
  });

  it("observationCount is positive", () => {
    expect(result.observationCount).toBeGreaterThan(0);
  });

  it("totalUniqueEvents equals events count", () => {
    expect(result.totalUniqueEvents).toBe(events.length);
  });

  it("summary counts add up to 8", () => {
    const { summary } = result;
    expect(summary.present + summary.notObserved + summary.insufficientContext).toBe(8);
  });

  it("each localization has required fields", () => {
    for (const loc of result.localizations) {
      expect(loc.situation_id).toBeDefined();
      expect(MAPPED_SITUATION_IDS).toContain(loc.situation_id);
      expect(loc.evidence_requirement).toBeDefined();
      expect(loc.evidence_requirement.situation_id).toBe(loc.situation_id);
      expect(["present", "not_observed", "insufficient_context"]).toContain(loc.presence);
      expect(Array.isArray(loc.clusters)).toBe(true);
      expect(typeof loc.totalRelevantEvents).toBe("number");
      if (loc.tickRange) {
        expect(typeof loc.tickRange.startTick).toBe("number");
        expect(typeof loc.tickRange.endTick).toBe("number");
        expect(loc.tickRange.startTick).toBeLessThanOrEqual(loc.tickRange.endTick);
      }
      expect(Array.isArray(loc.observedKinds)).toBe(true);
      expect(typeof loc.hasPositionData).toBe("boolean");
    }
  });
});

// ---------------------------------------------------------------------------
// 2. scanMatchResult (headless-match variant) works
// ---------------------------------------------------------------------------

describe("Scanner: scanMatchResult", () => {
  it("accepts full SimulationEvent objects from headless match", () => {
    // Create minimal mock events (not a full match, just verifying the API).
    const mockEvents: import("../../../src/contracts/scenario.js").SimulationEvent[] = [
      {
        id: "e1",
        tick: 10,
        sequence: 0,
        kind: "pass",
        label: "test pass",
        payload: {},
      },
      {
        id: "e2",
        tick: 15,
        sequence: 0,
        kind: "player-ball-contact",
        label: "test touch",
        payload: {},
      },
    ];
    const result = scanMatchResult(mockEvents, []);

    expect(result.localizations.length).toBe(MAPPED_SITUATION_IDS.length);
    expect(typeof result.totalTicks).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// 3. scanEvaluationEvents (stripped events variant) works
// ---------------------------------------------------------------------------

describe("Scanner: scanEvaluationEvents", () => {
  it("lifts stripped events and produces localizations", () => {
    const strippedEvents: Array<{ tick: number; id: string; kind: string; label: string }> = [
      { tick: 10, id: "e1", kind: "pass", label: "pass" },
      { tick: 15, id: "e2", kind: "player-ball-contact", label: "touch" },
      { tick: 20, id: "e3", kind: "shot", label: "shot" },
    ];
    const result = scanEvaluationEvents(strippedEvents, []);

    expect(result.localizations.length).toBe(MAPPED_SITUATION_IDS.length);
  });
});

// ---------------------------------------------------------------------------
// 4. Cluster shape correctness
// ---------------------------------------------------------------------------

describe("Scanner: cluster structure", () => {
  it("clusters have correct shape when present", { timeout: 30000 }, () => {
    const scenario = loadFixture("3v3-fixture.v1.json");
    const evalResult = evaluate({ scenario, safetyBounds: scenario.safetyBounds });
    const result = scanMatch(
      evalResult.events as import("../../../src/contracts/scenario.js").SimulationEvent[],
      evalResult.observations,
    );

    for (const loc of result.localizations) {
      for (const cluster of loc.clusters) {
        expect(typeof cluster.startTick).toBe("number");
        expect(typeof cluster.endTick).toBe("number");
        expect(cluster.startTick).toBeLessThanOrEqual(cluster.endTick);
        expect(Array.isArray(cluster.windows)).toBe(true);
        for (const win of cluster.windows) {
          expect(typeof win.startTick).toBe("number");
          expect(typeof win.endTick).toBe("number");
          expect(win.startTick).toBeLessThanOrEqual(win.endTick);
          expect(Array.isArray(win.events)).toBe(true);
          expect(typeof win.kindCount).toBe("number");
        }
        expect(typeof cluster.totalEvents).toBe("number");
        expect(cluster.kindSet instanceof Set).toBe(true);
        expect(["PASS", "FAIL", "NOT_EVALUATED"]).toContain(cluster.verdict);
        expect(typeof cluster.verdictReason).toBe("string");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Evidence requirement association
// ---------------------------------------------------------------------------

describe("Scanner: evidence requirement association", () => {
  it("each localization references the correct evidence requirement", { timeout: 30000 }, () => {
    const scenario = loadFixture("3v3-fixture.v1.json");
    const evalResult = evaluate({ scenario, safetyBounds: scenario.safetyBounds });
    const result = scanMatch(
      evalResult.events as import("../../../src/contracts/scenario.js").SimulationEvent[],
      evalResult.observations,
    );

    for (const loc of result.localizations) {
      const mappedReq = getSituationEvidence(loc.situation_id);
      expect(mappedReq).toBeDefined();
      expect(loc.evidence_requirement.situation_id).toBe(loc.situation_id);
      // Check required_event_kinds match.
      expect(loc.evidence_requirement.required_event_kinds).toEqual(mappedReq!.required_event_kinds);
      expect(loc.evidence_requirement.indicative_event_kinds).toEqual(mappedReq!.indicative_event_kinds);
      expect(loc.evidence_requirement.requires_position_data).toBe(mappedReq!.requires_position_data);
      expect(loc.evidence_requirement.requires_team_geometry).toBe(mappedReq!.requires_team_geometry);
      expect(loc.evidence_requirement.evidence_chain).toBe(mappedReq!.evidence_chain);
    }
  });
});