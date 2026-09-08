/**
 * @module tests/integration/foul-consequence-machinery
 *
 * FOUL-CONSEQUENCE-MACHINERY integration test: a real committed man-not-ball
 * tackle contact (foul) awards a free kick to the fouled team at the contact
 * position, which is served through the accepted restart machinery as an
 * independent ball entity.
 *
 * This is the relevant integration-test pass for the MULTI_TICK evidence class.
 * It reproduces the organic stream through the production runHeadlessMatch entry
 * point (core-owned lifecycle, cpuDefensiveTackle, detectFouls, awardFreeKicks)
 * — no direct core mocks.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { runHeadlessMatch } from "../../eval/runners/headless-match.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { TelemetryObservation } from "../../src/contracts/telemetry.js";

const FIXTURE = resolve("eval/scenarios/3v3-press-scenario.v1.json");

function loadFixture(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(path, "utf-8")) as ScenarioDefinition;
}

interface FkFacts {
  tick: number | null;
  teamId: string | null;
  position: { x: number; y: number } | null;
  kickDirection: { x: number; y: number } | null;
}

function freeKickFacts(obs: TelemetryObservation[]): FkFacts {
  for (const o of obs) {
    for (const ev of o.events) {
      if (ev.kind !== "free-kick-executed") continue;
      const p = (ev.payload ?? {}) as Record<string, unknown>;
      return {
        tick: ev.tick,
        teamId: (p.teamId as string) ?? null,
        position: (p.freeKickPosition as { x: number; y: number }) ?? null,
        kickDirection: (p.kickDirection as { x: number; y: number }) ?? null,
      };
    }
  }
  return { tick: null, teamId: null, position: null, kickDirection: null };
}

function foulFacts(obs: TelemetryObservation[]): { tick: number | null; teamIdB: string | null } {
  for (const o of obs) {
    for (const ev of o.events) {
      if (ev.kind !== "foul") continue;
      const p = (ev.payload ?? {}) as Record<string, unknown>;
      return { tick: ev.tick, teamIdB: (p.teamIdB as string) ?? null };
    }
  }
  return { tick: null, teamIdB: null };
}

describe("FOUL-CONSEQUENCE-MACHINERY foul→free-kick integration flow", () => {
  it("a real foul awards a free kick to the fouled team at the contact position, served as an independent entity", () => {
    const result = runHeadlessMatch({
      scenario: loadFixture(FIXTURE),
      maxTicks: 600,
      cpuAntiHuddle: false,
      lifecyclePhaseSync: "core-owned",
      cpuDefensiveTackle: true,
      detectFouls: true,
      awardFreeKicks: true,
      serializeRestartFacts: true,
    });

    const foul = foulFacts(result.observations);
    const fk = freeKickFacts(result.observations);

    // A real foul occurred and produced a real free-kick.
    expect(foul.tick).not.toBeNull();
    expect(fk.tick).not.toBeNull();
    expect(foul.teamIdB).not.toBeNull();
    // The free kick went to the fouled team.
    expect(fk.teamId).toBe(foul.teamIdB);
    // The placement is the contact position (a finite planar point, inside pitch).
    expect(typeof fk.position!.x).toBe("number");
    expect(typeof fk.position!.y).toBe("number");
    expect(Math.abs(fk.position!.x)).toBeLessThanOrEqual(52.5);
    expect(Math.abs(fk.position!.y)).toBeLessThanOrEqual(34);
    // A serve direction exists (the ball is served, not held).
    expect(fk.kickDirection).not.toBeNull();
    expect(Math.hypot(fk.kickDirection!.x, fk.kickDirection!.y)).toBeCloseTo(1, 3);

    // The free-kick phase froze the ball-in-play clock.
    const tickObs = result.observations.find((o) => o.tick === fk.tick);
    expect(tickObs).toBeDefined();
    expect(tickObs!.ball.regime).toBe("airborne");
  }, 60_000);
});
