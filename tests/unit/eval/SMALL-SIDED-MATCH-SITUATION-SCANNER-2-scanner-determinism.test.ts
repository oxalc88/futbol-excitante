/**
 * @module tests/unit/eval/SMALL-SIDED-MATCH-SITUATION-SCANNER-2-scanner-determinism.test.ts
 *
 * Tests for scanner determinism: two identical runs produce identical
 * localization output.
 *
 *  1. Two scanMatch calls with the same events produce identical results.
 *  2. Determinism holds for both 3v3 and 5v5 fixtures.
 *  3. Determinism holds for scanEvaluationEvents (stripped events).
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
  scanEvaluationEvents,
  type MatchSituationScanResult,
} from "../../../eval/runners/small-sided-match-situation-scanner.js";

import { MAPPED_SITUATION_IDS } from "../../../eval/contracts/situation-mapping.js";

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
// 1. Identical events → identical results (3v3)
// ---------------------------------------------------------------------------

describe("Scanner determinism: 3v3-fixture", () => {
  let scenario: import("../../../src/contracts/scenario.js").ScenarioDefinition;
  let events: Array<{ tick: number; id: string; kind: string; label: string }>;
  let observations: import("../../../src/contracts/telemetry.js").TelemetryObservation[];

  beforeAll(() => {
    scenario = loadFixture("3v3-fixture.v1.json");
    const evalResult = evaluate({ scenario, safetyBounds: scenario.safetyBounds });
    events = evalResult.events;
    observations = evalResult.observations;
  }, 60_000);

  it("two scanMatch calls produce identical results", () => {
    const result1 = scanMatch(events as any, observations);
    const result2 = scanMatch(events as any, observations);

    // Deep compare via JSON serialization (avoids Set/Map comparison issues).
    const json1 = JSON.stringify(result1);
    const json2 = JSON.stringify(result2);
    expect(json1).toBe(json2);
  });

  it("individual localization outputs are identical", () => {
    const result1 = scanMatch(events as any, observations);
    const result2 = scanMatch(events as any, observations);

    expect(result1.localizations.length).toBe(result2.localizations.length);

    for (let i = 0; i < result1.localizations.length; i++) {
      const l1 = result1.localizations[i];
      const l2 = result2.localizations[i];

      expect(l1.situation_id).toBe(l2.situation_id);
      expect(l1.presence).toBe(l2.presence);
      expect(l1.totalRelevantEvents).toBe(l2.totalRelevantEvents);

      if (l1.tickRange) {
        expect(l2.tickRange).toBeDefined();
        expect(l1.tickRange).toEqual(l2.tickRange);
      }

      expect(l1.clusters.length).toBe(l2.clusters.length);
      for (let j = 0; j < l1.clusters.length; j++) {
        const c1 = l1.clusters[j];
        const c2 = l2.clusters[j];
        expect(c1.startTick).toBe(c2.startTick);
        expect(c1.endTick).toBe(c2.endTick);
        expect(c1.totalEvents).toBe(c2.totalEvents);
        expect(JSON.stringify([...c1.kindSet])).toBe(JSON.stringify([...c2.kindSet]));
        expect(c1.verdict).toBe(c2.verdict);
        expect(c1.verdictReason).toBe(c2.verdictReason);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Identical events → identical results (5v5)
// ---------------------------------------------------------------------------

describe("Scanner determinism: 5v5-fixture", () => {
  let scenario: import("../../../src/contracts/scenario.js").ScenarioDefinition;
  let events: Array<{ tick: number; id: string; kind: string; label: string }>;
  let observations: import("../../../src/contracts/telemetry.js").TelemetryObservation[];

  beforeAll(() => {
    scenario = loadFixture("5v5-fixture-v1.json");
    const evalResult = evaluate({ scenario, safetyBounds: scenario.safetyBounds });
    events = evalResult.events;
    observations = evalResult.observations;
  }, 60_000);

  it("two scanMatch calls produce identical results", () => {
    const result1 = scanMatch(events as any, observations);
    const result2 = scanMatch(events as any, observations);

    const json1 = JSON.stringify(result1);
    const json2 = JSON.stringify(result2);
    expect(json1).toBe(json2);
  });
});

// ---------------------------------------------------------------------------
// 3. Determinism: scanEvaluationEvents (stripped events)
// ---------------------------------------------------------------------------

describe("Scanner determinism: scanEvaluationEvents", () => {
  it("identical stripped events produce identical results", () => {
    const strippedEvents: Array<{ tick: number; id: string; kind: string; label: string }> = [
      { tick: 10, id: "e1", kind: "pass", label: "pass" },
      { tick: 15, id: "e2", kind: "player-ball-contact", label: "touch" },
      { tick: 20, id: "e3", kind: "shot", label: "shot" },
      { tick: 30, id: "e4", kind: "player-player-contact", label: "contact" },
    ];

    const result1 = scanEvaluationEvents(strippedEvents, []);
    const result2 = scanEvaluationEvents(strippedEvents, []);

    const json1 = JSON.stringify(result1);
    const json2 = JSON.stringify(result2);
    expect(json1).toBe(json2);
  });
});

// ---------------------------------------------------------------------------
// 4. All localizations cover all 8 situations (determinism check)
// ---------------------------------------------------------------------------

describe("Scanner determinism: complete coverage", () => {
  it("3v3: both runs produce localizations for all 8 situations", { timeout: 30000 }, () => {
    const scenario = loadFixture("3v3-fixture.v1.json");
    const evalResult = evaluate({ scenario, safetyBounds: scenario.safetyBounds });

    const result1 = scanMatch(
      evalResult.events as import("../../../src/contracts/scenario.js").SimulationEvent[],
      evalResult.observations,
    );
    const result2 = scanMatch(
      evalResult.events as import("../../../src/contracts/scenario.js").SimulationEvent[],
      evalResult.observations,
    );

    const ids1 = new Set(result1.localizations.map((l) => l.situation_id));
    const ids2 = new Set(result2.localizations.map((l) => l.situation_id));

    for (const id of MAPPED_SITUATION_IDS) {
      expect(ids1.has(id)).toBe(true);
      expect(ids2.has(id)).toBe(true);
    }
  });
});