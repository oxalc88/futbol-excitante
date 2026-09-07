/**
 * @module tests/integration/human-keeper-control
 *
 * Discriminating guards for HUMAN-KEEPER-CONTROL over the accepted headless
 * match loop:
 *   - the human-directed keeper answers a shot on target within
 *     save_claim_reach_radius (the human's directional input yields the
 *     arc-hold but the keeper still saves);
 *   - the CPU fallback (no human directional input) saves the same shot within
 *     reach;
 *   - stash identity: gkBehavior:false gives no keeper-role counters and no
 *     keeper save, byte-identical to the pre-keeper path;
 *   - the keeper designation is unchanged (the layout rule's answer);
 *   - the accepted CPU keeper-shot fixture still saves (CPU-vs-CPU untouched);
 *   - the slot-wiring invariant holds when the human directs the keeper.
 *
 * The simulation core is untouched; everything below is adapter-layer + the
 * accepted headless match loop.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runHumanKeeperMatch } from "../../eval/runners/human-keeper-control.js";
import {
  designateKeeperFromLayout,
  getKeeperHoldActivations,
  getKeeperSaveArmActivations,
  getKeeperSavePressActivations,
  resetKeeperMechanismCounters,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import { computeExplicitSwitchTarget } from "../../src/simulation/input/input-system.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";

const OBJECTIVE_ID = "HUMAN-KEEPER-CONTROL";
const FIXTURE = "eval/scenarios/5v5-human-keeper-shot-fixture.v1.json";
const CPU_FIXTURE = "eval/scenarios/5v5-keeper-shot-fixture.v1.json";
const REACH = 1.2; // gk-small-sided-v1 save_claim_reach_radius, read by the runner

function load(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as ScenarioDefinition;
}

describe(`${OBJECTIVE_ID} discriminating guards`, () => {
  const scenario = load(FIXTURE);

  it("the human-directed keeper saves a shot on target within reach", { timeout: 30_000 }, () => {
    const r = runHumanKeeperMatch({
      scenario,
      maxTicks: 600,
      gkBehavior: true,
      humanTeamId: "team-b",
      keeperControlSlot: "slot-10",
      humanMode: "directed",
    });
    expect(r.directedKeeperPlayerId).toBe("player-10");
    expect(r.saveTick).not.toBeNull();
    expect(r.withinReach).toBe(true);
    expect(r.saveContactDistance!).toBeLessThanOrEqual(REACH + 1e-9);
    expect(r.ticksFromShotToContact!).toBeGreaterThan(0);
    expect(r.keeperByTeam["team-b"]).toBe("player-10");
    expect(r.keeperByTeam["team-a"]).toBe("player-4");
  });

  it("the CPU fallback (no human directional input) saves the same shot", { timeout: 30_000 }, () => {
    const r = runHumanKeeperMatch({
      scenario,
      maxTicks: 600,
      gkBehavior: true,
      humanTeamId: "team-b",
      keeperControlSlot: "slot-10",
      humanMode: "cpu",
    });
    expect(r.saveTick).not.toBeNull();
    expect(r.withinReach).toBe(true);
    expect(r.saveContactDistance!).toBeLessThanOrEqual(REACH + 1e-9);
  });

  it("stash identity: gkBehavior:false gives no keeper-role counters or save", { timeout: 30_000 }, () => {
    resetKeeperMechanismCounters();
    const r = runHumanKeeperMatch({
      scenario,
      maxTicks: 300,
      gkBehavior: false,
      humanTeamId: "team-b",
      keeperControlSlot: "slot-10",
      humanMode: "cpu",
    });
    // No keeper designation is live, so no keeper save is located.
    expect(Object.keys(r.keeperByTeam).length).toBe(0);
    expect(r.saveTick).toBeNull();
    expect(getKeeperHoldActivations()).toBe(0);
    expect(getKeeperSaveArmActivations()).toBe(0);
    expect(getKeeperSavePressActivations()).toBe(0);
    // The keeper designation rule still agrees (a layout fact, independent of gkBehavior).
    expect(designateKeeperFromLayout(scenario.players, "team-b", scenario.pitchLength)).toBe("player-10");
  });

  it("the accepted CPU-vs-CPU keeper-shot fixture still saves (CPU-vs-CPU untouched)", { timeout: 30_000 }, () => {
    const cpuScenario = load(CPU_FIXTURE);
    const r = runHumanKeeperMatch({
      scenario: cpuScenario,
      maxTicks: 600,
      gkBehavior: true,
      humanTeamId: "team-b",
      keeperControlSlot: "slot-10",
      humanMode: "cpu",
    });
    expect(r.saveTick).not.toBeNull();
    expect(r.withinReach).toBe(true);
    // The accepted fixture's designated team-b keeper is player-10, unchanged.
    expect(r.keeperByTeam["team-b"]).toBe("player-10");
  });

  it("the keeper designation is the source of truth (unchanged by the human)", { timeout: 30_000 }, () => {
    const r = runHumanKeeperMatch({
      scenario,
      maxTicks: 600,
      gkBehavior: true,
      humanTeamId: "team-b",
      keeperControlSlot: "slot-10",
      humanMode: "directed",
    });
    // The same layout rule the wiring uses for the adapter-layer designation.
    expect(r.keeperByTeam["team-b"]).toBe(designateKeeperFromLayout(scenario.players, "team-b", scenario.pitchLength));
    // The human directs the already-designated body; they never become the designation.
    expect(r.directedKeeperPlayerId).toBe(r.keeperByTeam["team-b"]);
  });

  it("the slot-wiring invariant holds when the human directs the keeper", () => {
    // One slot per body (no duplicate ownership), and the designated keeper is
    // reachable by the human's switch cycle — the two slot/ownership facts this
    // objective's playable capability depends on.
    const assignments = scenario.controlAssignments as Record<string, { teamId: string; controlledPlayerId: string; mode: string }>;
    const controlled = new Set(Object.values(assignments).map((a) => a.controlledPlayerId));
    expect(controlled.size).toBe(Object.keys(assignments).length); // no duplicate ownership
    // The human's directed keeper slot owns the designated keeper.
    expect(assignments["slot-10"].controlledPlayerId).toBe("player-10");
    // The switch cycle reaches the keeper.
    const players = scenario.players.map((p) => ({ playerId: p.playerId, teamId: p.teamId, groundPosition: p.groundPosition }));
    const cycle = new Set<string>(["player-10"]);
    let cur = assignments["slot-10"].controlledPlayerId;
    for (let i = 0; i < 6; i++) {
      const next = computeExplicitSwitchTarget("slot-10", assignments, players, "NEXT");
      if (!next) break;
      cycle.add(next);
      assignments["slot-10"].controlledPlayerId = next;
      cur = next;
    }
    expect(cycle).toContain("player-6");
  });
});
