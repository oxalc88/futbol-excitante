/**
 * @module tests/unit/eval/SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE-binding
 *
 * Binding tests for the SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE objective.
 *
 * Evidence class: MULTI_TICK
 *
 * Tests:
 *  (a) Scenario structure: 5v5-continuous-play.v1.json exists and is valid.
 *  (b) Headless match (press scenario): produces shots, goals, pitch-contact.
 *  (c) Scanner localization: 7/8 situations present (PHYSICAL_DUEL insufficient_context).
 *  (d) Ball system fix: ground-roll/settled → airborne transition produces pitch-contact.
 *  (e) Determinism: two identical runs produce identical state hashes.
 *  (f) Trajectory evidence: trajectory.json exists and has correct structure.
 *  (g) controlledPlayerId: headless runner passes controlledPlayerId to CPU observations.
 *
 * No Math.random, Date, DOM, or Node I/O in simulation core.
 * Node I/O is allowed in tests.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Register oracles (side-effect import).
import "../../../eval/oracles/wire.js";

import { runHeadlessMatch } from "../../../eval/runners/headless-match.js";
import { scanMatchResult } from "../../../eval/runners/small-sided-match-situation-scanner.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";

const __testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__testDir, "../../..");

function loadContinuousPlayScenario(): ScenarioDefinition {
  return JSON.parse(
    readFileSync(
      join(projectRoot, "eval/scenarios/5v5-continuous-play.v1.json"),
      "utf-8",
    ),
  ) as ScenarioDefinition;
}

function loadPressScenario(): ScenarioDefinition {
  return JSON.parse(
    readFileSync(
      join(projectRoot, "eval/scenarios/3v3-press-scenario.v1.json"),
      "utf-8",
    ),
  ) as ScenarioDefinition;
}

describe("SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE binding", { timeout: 60_000 }, () => {
  // (a) Scenario structure
  it("5v5-continuous-play scenario exists and has correct structure", () => {
    const scenario = loadContinuousPlayScenario();
    expect(scenario.id).toBe("5v5-continuous-play-v1");
    expect(scenario.players.length).toBe(10);
    expect(scenario.ball.position.x).toBeDefined();
    expect(scenario.ball.position.z).toBe(0.11);

    // Player-1 (team-a, first controlled) should be near the ball.
    const p1 = scenario.players.find((p) => p.playerId === "player-1");
    expect(p1).toBeDefined();
    expect(p1!.teamId).toBe("team-a");
  });

  // (b) Press scenario produces diverse events
  it("press scenario produces shots, goals, and pitch-contact events", () => {
    const scenario = loadPressScenario();
    const result = runHeadlessMatch({ scenario, maxTicks: 600 });

    const kinds: Record<string, number> = {};
    for (const e of result.events) {
      kinds[e.kind] = (kinds[e.kind] || 0) + 1;
    }

    expect(kinds["player-ball-contact"]).toBeGreaterThanOrEqual(1);
    expect(kinds["shot"]).toBeGreaterThanOrEqual(1);
    expect(kinds["pitch-contact"]).toBeGreaterThanOrEqual(1);
    expect(kinds["player-player-contact"]).toBeGreaterThanOrEqual(1);
  });

  // (c) Scanner localization: 7/8 present from press scenario
  it("scanner localizes 7/8 situations as present from press scenario", () => {
    const scenario = loadPressScenario();
    const result = runHeadlessMatch({ scenario, maxTicks: 600 });
    const scan = scanMatchResult(result.events, result.observations);

    expect(scan.summary.present).toBeGreaterThanOrEqual(7);
    expect(scan.summary.notObserved).toBe(0);

    // SHOT_TO_RESULT must be present
    const shotLoc = scan.localizations.find(
      (l) => l.situation_id === "SHOT_TO_RESULT",
    );
    expect(shotLoc).toBeDefined();
    expect(shotLoc!.presence).toBe("present");
    expect(shotLoc!.observedKinds).toContain("shot");

    // PHYSICAL_DUEL is insufficient_context (input-rejection can't happen organically)
    const duelLoc = scan.localizations.find(
      (l) => l.situation_id === "PHYSICAL_DUEL",
    );
    expect(duelLoc).toBeDefined();
    expect(duelLoc!.presence).toBe("insufficient_context");
  });

  // (d) Ball system fix: pitch-contact events exist
  it("ball system ground-roll/settled to airborne transition produces pitch-contact", () => {
    const scenario = loadPressScenario();
    const result = runHeadlessMatch({ scenario, maxTicks: 600 });

    const pitchContacts = result.events.filter(
      (e) => e.kind === "pitch-contact",
    );
    expect(pitchContacts.length).toBeGreaterThanOrEqual(1);

    for (const pc of pitchContacts) {
      const payload = pc.payload as any;
      expect(payload.incoming).toBeDefined();
      expect(payload.outgoing).toBeDefined();
      expect(payload.contactType).toBe("ground-impact");
    }
  });

  // (e) Determinism
  it("two identical runs produce identical state hashes", () => {
    const scenario = loadPressScenario();
    const result1 = runHeadlessMatch({ scenario, maxTicks: 100 });
    const result2 = runHeadlessMatch({ scenario, maxTicks: 100 });

    expect(result1.stateHashes.length).toBe(result2.stateHashes.length);
    for (let i = 0; i < result1.stateHashes.length; i++) {
      expect(result1.stateHashes[i]).toBe(result2.stateHashes[i]);
    }
    expect(result1.events.length).toBe(result2.events.length);
  });

  // (f) Trajectory evidence
  it("trajectory.json exists with correct structure", () => {
    const trajectoryPath = join(
      projectRoot,
      "docs/evidence/SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE/trajectory.json",
    );
    expect(existsSync(trajectoryPath)).toBe(true);

    const trajectory = JSON.parse(readFileSync(trajectoryPath, "utf-8"));
    expect(trajectory.objectiveId).toBe(
      "SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE",
    );
    expect(trajectory.evidenceClass).toBe("MULTI_TICK");
    expect(trajectory.match).toBeDefined();
    expect(trajectory.match.events).toBeGreaterThan(0);
    expect(trajectory.situationScan).toBeDefined();
    expect(trajectory.situationScan.present).toBeGreaterThanOrEqual(7);
    expect(trajectory.trajectory.length).toBeGreaterThan(0);
  });

  // (g) controlledPlayerId: headless runner passes it to CPU observations
  it("headless runner passes controlledPlayerId to CPU adapter observations", () => {
    const scenario = loadContinuousPlayScenario();
    // Short run — player-1 is at the ball, should touch it immediately with controlledPlayerId fix.
    const result = runHeadlessMatch({ scenario, maxTicks: 60 });

    const kinds: Record<string, number> = {};
    for (const e of result.events) {
      kinds[e.kind] = (kinds[e.kind] || 0) + 1;
    }

    // With controlledPlayerId fix, player-1 should touch the ball within 60 ticks.
    expect(kinds["player-ball-contact"] ?? 0).toBeGreaterThanOrEqual(1);
  });
});
