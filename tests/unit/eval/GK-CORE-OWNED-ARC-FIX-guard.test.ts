/**
 * @module tests/unit/eval/GK-CORE-OWNED-ARC-FIX-guard.test.ts
 *
 * Discriminating guards for GK-CORE-OWNED-ARC-FIX.
 *
 * ROOT CAUSE: under the core-owned lifecycle a post-goal/halftime reset re-places
 * every body at its scenario kickoff home.  This fixture designates team-a's
 * keeper (player-4) from a defender whose kickoff home is ~24.6 m off its goal
 * arc, so that reset strands the keeper off-arc (GK-POSITIONING-HOLD /
 * GK-NO-FIELD-CHASE FAIL).  Team-b's keeper (player-10) holds because its kickoff
 * home IS its arc.  Under the legacy lifecycle the reset never executed, masking
 * the drift.
 *
 * FIX: the runner re-homes a designated keeper whose kickoff home is off its goal
 * arc onto that arc (its true home, spec §5) before the world is created, gated
 * to `gkBehavior` and the core-owned policy so the `gkBehavior:false` stash
 * identity and the accepted legacy pins stay byte-identical.
 *
 * Guards:
 *   1. The re-home is targeted: an off-arc keeper is moved onto its arc, an
 *      on-arc keeper is left untouched, and it is deterministic.
 *   2. The core-owned gk-shot-fixture run PASSes the protected GK-POSITIONING-HOLD
 *      and GK-NO-FIELD-CHASE oracles (the drift is gone).
 *   3. The protected oracles are NOT weakened: a keeper stranded off-arc still
 *      FAILs both oracles.
 *   4. The re-home is gated: the `gkBehavior:false` control and the legacy
 *      opt-out do not re-home the keeper (stash identity / legacy pins preserved).
 *
 * Node I/O is allowed for scenario loading.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runHeadlessMatch, rehomeKeeperToArc } from "../../../eval/runners/headless-match.js";
import {
  checkGkPositioningHold,
  checkGkNoFieldChase,
} from "../../../eval/oracles/gk-role.js";
import {
  goalArcCenter,
  isInsideGoalArc,
  distanceToArcCenter,
} from "../../../src/adapters/input-browser/goalkeeper-role.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";
import type { TelemetryObservation } from "../../../src/contracts/telemetry.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function loadScenario(relativePath: string): ScenarioDefinition {
  return JSON.parse(
    readFileSync(join(projectRoot, relativePath), "utf-8"),
  ) as ScenarioDefinition;
}

const FIXTURE = "eval/scenarios/5v5-keeper-shot-fixture.v1.json";

/** Run the shot fixture under a given lifecycle + gkBehavior and evaluate the oracles. */
function runFixture(
  lifecyclePhaseSync: "legacy" | "core-owned",
  gkBehavior: boolean,
) {
  const scenario = loadScenario(FIXTURE);
  return runHeadlessMatch({
    scenario,
    maxTicks: 600,
    cpuAntiHuddle: true,
    cpuDefensiveTackle: true,
    gkBehavior,
    browserParityObservations: true,
    lifecyclePhaseSync,
  });
}

function gkVerdicts(observations: TelemetryObservation[]): {
  positioning: string;
  noFieldChase: string;
} {
  const pos = checkGkPositioningHold(observations);
  const chase = checkGkNoFieldChase(observations);
  return {
    positioning: pos[0]?.status ?? "none",
    noFieldChase: chase[0]?.status ?? "none",
  };
}

describe("GK-CORE-OWNED-ARC-FIX: the re-home is targeted and deterministic", () => {
  it("re-homes an off-arc keeper onto its goal arc but leaves an on-arc keeper untouched", () => {
    const scenario = loadScenario(FIXTURE);
    const rehomed = rehomeKeeperToArc(scenario);
    const teamA = rehomed.players.find((p) => p.playerId === "player-4")!;
    const teamB = rehomed.players.find((p) => p.playerId === "player-10")!;
    const centerA = goalArcCenter("team-a", scenario.pitchLength);
    const centerB = goalArcCenter("team-b", scenario.pitchLength);

    // team-a's keeper starts 24.6 m off-arc → must be re-homed onto the arc.
    expect(isInsideGoalArc(teamA.groundPosition, centerA)).toBe(true);
    expect(distanceToArcCenter(teamA.groundPosition, centerA)).toBeLessThanOrEqual(2.5 + 1e-6);
    // team-b's keeper already holds its arc → left untouched.
    expect(teamB.groundPosition.x).toBeCloseTo(52.4, 6);
    expect(teamB.groundPosition.y).toBeCloseTo(-0.3, 6);
    expect(isInsideGoalArc(teamB.groundPosition, centerB)).toBe(true);
  });

  it("is deterministic: same scenario → byte-identical re-homed scenario", () => {
    const scenario = loadScenario(FIXTURE);
    expect(rehomeKeeperToArc(scenario)).toEqual(rehomeKeeperToArc(scenario));
  });
});

describe("GK-CORE-OWNED-ARC-FIX: the core-owned gk-shot-fixture run holds the arc", () => {
  it(
    "the designated team-a keeper holds its arc under core-owned (oracles PASS)",
    () => {
      const match = runFixture("core-owned", true);
      const verdicts = gkVerdicts(match.observations);
      expect(verdicts.positioning).toBe("pass");
      expect(verdicts.noFieldChase).toBe("pass");

      // The designated team-a keeper is on its arc for the whole run after the
      // reset (the drift is gone), and the max distance stays inside the arc.
      const center = goalArcCenter("team-a", 105);
      const keeper = match.observations[0].players.find((p) => p.playerId === "player-4")!;
      expect(isInsideGoalArc(keeper.groundPosition, center)).toBe(true);
    },
    120_000,
  );
});

describe("GK-CORE-OWNED-ARC-FIX: the protected oracles are not weakened", () => {
  it("a keeper stranded off-arc still FAILs GK-POSITIONING-HOLD and GK-NO-FIELD-CHASE", () => {
    // Build a two-team GK stream where team-a's keeper takes station then is
    // placed far off its arc (the mutant the oracles must still catch).
    const center = goalArcCenter("team-a", 105);
    const make = (tick: number, keeperPos: { x: number; y: number }) => ({
      tick,
      simulationTime: tick / 60,
      prngAlgorithmId: "mulberry32-v1",
      stateHash: `h-${tick}`,
      prngStateHash: `p-${tick}`,
      observationCoreHash: `c-${tick}`,
      committedTick: tick,
      inputs: [],
      players: [
        { playerId: "player-4", teamId: "team-a", groundPosition: keeperPos, linearVelocity: { x: 0, y: 0 }, desiredVelocity: { x: 0, y: 0 }, bodyHeading: 0, desiredHeading: 0 },
        { playerId: "player-10", teamId: "team-b", groundPosition: { x: 52.4, y: -0.3 }, linearVelocity: { x: 0, y: 0 }, desiredVelocity: { x: 0, y: 0 }, bodyHeading: 0, desiredHeading: 0 },
        { playerId: "player-1", teamId: "team-a", groundPosition: { x: 30, y: 0 }, linearVelocity: { x: 0, y: 0 }, desiredVelocity: { x: 0, y: 0 }, bodyHeading: 0, desiredHeading: 0 },
        { playerId: "player-6", teamId: "team-b", groundPosition: { x: 30, y: 0 }, linearVelocity: { x: 0, y: 0 }, desiredVelocity: { x: 0, y: 0 }, bodyHeading: 0, desiredHeading: 0 },
      ],
      ball: { position: { x: 0, y: 0, z: 0.11 }, linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 }, regime: "ground-roll", lastTouchRef: null },
      events: [
        { id: `gk-role-${tick}-a`, tick, sequence: 9001, kind: "gk-role", label: "designated keeper player-4", payload: { teamId: "team-a", keeperPlayerId: "player-4", keeperRoleFlag: true, pitchLength: 105 } },
        { id: `gk-role-${tick}-b`, tick, sequence: 9002, kind: "gk-role", label: "designated keeper player-10", payload: { teamId: "team-b", keeperPlayerId: "player-10", keeperRoleFlag: true, pitchLength: 105 } },
      ],
    } as unknown as TelemetryObservation);

    // tick 1: keeper on the arc (station). tick 2: keeper stranded at its
    // off-arc kickoff home — the exact mutant the fix must not mask.
    const onArc = { x: -52.4, y: -0.3 };
    expect(isInsideGoalArc(onArc, center)).toBe(true);
    const stranded = { x: -30, y: -10 };
    const obs = [make(1, onArc), make(2, stranded)];

    const pos = checkGkPositioningHold(obs);
    const chase = checkGkNoFieldChase(obs);
    expect(pos[0]?.status).toBe("fail");
    expect(chase[0]?.status).toBe("fail");
  });
});

describe("GK-CORE-OWNED-ARC-FIX: the re-home is gated so the accepted pins stay", () => {
  it("the gkBehavior:false control does not re-home the keeper (stash identity preserved)", () => {
    // gkBehavior:false → no keeper role → no re-home → player-4 stays at its
    // fixture kickoff home, so the stash-identity chain is untouched.
    const match = runFixture("core-owned", false);
    const p4 = match.observations[0].players.find((p) => p.playerId === "player-4")!;
    expect(p4.groundPosition.x).toBeCloseTo(-30, 6);
    expect(p4.groundPosition.y).toBeCloseTo(-10, 6);
  }, 120_000);

  it("the legacy opt-out does not re-home the keeper (legacy pins preserved)", () => {
    // Under the legacy lifecycle the keeper transits from its kickoff home; the
    // re-home is core-owned-only, so player-4's kickoff home stays the fixture's.
    const match = runFixture("legacy", true);
    const p4 = match.observations[0].players.find((p) => p.playerId === "player-4")!;
    expect(p4.groundPosition.x).toBeCloseTo(-30, 6);
    expect(p4.groundPosition.y).toBeCloseTo(-10, 6);
  }, 120_000);
});
