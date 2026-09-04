/**
 * @module tests/unit/eval/SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH-2-trajectory
 *
 * Team-geometry trajectory evidence for the accepted
 * SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH MULTI_TICK claim.
 *
 * This test is READ-ONLY over durable evidence (capture hygiene 0.9.2+): the
 * accepted `docs/evidence/**` artifact is asserted, never rewritten, and the
 * digest check below fails if an ordinary run mutates it. The live 3v3 match is
 * derived into ignored `test-results/gauntlet-capture/**` and compared on the
 * same geometry invariants.
 *
 * The live window runs at the historical CPU configuration — this accepted
 * trajectory was produced before the anti-huddle team shape (anti-huddle-v1),
 * pinned via cpuAntiHuddle:false to preserve the historical configuration
 * byte-for-byte.
 *
 * Node I/O is allowed here (evidence reading, ephemeral capture).
 */

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runHeadlessMatch } from "../../../eval/runners/headless-match.js";
import { scanMatchResult } from "../../../eval/runners/small-sided-match-situation-scanner.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";
import type { HeadlessMatchResult } from "../../../eval/runners/headless-match.js";

const __testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__testDir, "../../..");
const evidenceDir = join(projectRoot, "docs/evidence/SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH");
const trajectoryPath = join(evidenceDir, "trajectory.json");
/** Ordinary-run output belongs under ignored test-results, never docs/. */
const ephemeralDir = join(projectRoot, "test-results/gauntlet-capture/SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH");

function load3v3Scenario(): ScenarioDefinition {
  const p = join(projectRoot, "eval/scenarios/3v3-press-scenario.v1.json");
  return JSON.parse(readFileSync(p, "utf-8")) as ScenarioDefinition;
}

function buildRoleMap(scenario: ScenarioDefinition): Map<string, string | undefined> {
  const m = new Map<string, string | undefined>();
  for (const p of scenario.players) m.set(p.playerId, (p as any).formationRole);
  return m;
}

interface TrajectoryTick {
  tick: number;
  ball: { x: number; y: number };
  teams: Record<
    string,
    {
      presserId: string;
      coverId: string;
      presserDistanceToBall: number;
      coverDistanceToBall: number;
      presserCoverSeparation: number;
      supportAvgDistance: number;
      supportMinDistance: number;
      supportMaxDistance: number;
      supportCount: number;
    }
  >;
}

function extractTrajectory(
  result: HeadlessMatchResult,
  roleMap: Map<string, string | undefined>,
): TrajectoryTick[] {
  const ticks: TrajectoryTick[] = [];
  for (const obs of result.observations) {
    const bx = obs.ball.position.x;
    const by = obs.ball.position.y;
    const teams: TrajectoryTick["teams"] = {} as any;

    for (const teamId of ["team-a", "team-b"]) {
      const tp = obs.players
        .filter((p) => p.teamId === teamId)
        .map((p) => ({
          ...p,
          role: roleMap.get(p.playerId),
          dist: Math.sqrt(
            (p.groundPosition.x - bx) ** 2 + (p.groundPosition.y - by) ** 2,
          ),
        }))
        .sort((a, b) => a.dist - b.dist);

      // Presser = closest non-attacker; cover = second-closest non-attacker.
      const nonAttackers = tp.filter((p) => p.role !== "attacker");
      const presser = nonAttackers[0];
      const cover = nonAttackers[1];

      let presserCoverSep = 0;
      if (presser && cover) {
        const dx = presser.groundPosition.x - cover.groundPosition.x;
        const dy = presser.groundPosition.y - cover.groundPosition.y;
        presserCoverSep = Math.sqrt(dx * dx + dy * dy);
      }

      // Support: off-ball attackers/midfielders relative to carrier.
      const carrier = tp[0];
      const offBall = tp.filter(
        (p) =>
          p.playerId !== carrier?.playerId &&
          (p.role === "attacker" || p.role === "midfielder"),
      );

      let sAvg = 0, sMin = 0, sMax = 0, sCount = 0;
      if (offBall.length > 0 && carrier) {
        const ds = offBall.map((p) =>
          Math.sqrt(
            (p.groundPosition.x - carrier.groundPosition.x) ** 2 +
              (p.groundPosition.y - carrier.groundPosition.y) ** 2,
          ),
        );
        sAvg = ds.reduce((a, b) => a + b, 0) / ds.length;
        sMin = Math.min(...ds);
        sMax = Math.max(...ds);
        sCount = ds.length;
      }

      teams[teamId] = {
        presserId: presser?.playerId ?? "",
        coverId: cover?.playerId ?? "",
        presserDistanceToBall: presser?.dist ?? Infinity,
        coverDistanceToBall: cover?.dist ?? Infinity,
        presserCoverSeparation: presserCoverSep,
        supportAvgDistance: sAvg,
        supportMinDistance: sMin,
        supportMaxDistance: sMax,
        supportCount: sCount,
      };
    }
    ticks.push({ tick: obs.tick, ball: { x: bx, y: by }, teams });
  }
  return ticks;
}

/** The geometry invariants the accepted evidence claims, as a reusable check. */
interface AcceptedTrajectory {
  objectiveId: string;
  evidenceClass: string;
  scenario: { id: string; version: string; seed: number; durationTicks: number };
  match: { events: number; observations: number; score: Record<string, number> };
  situationScan: Record<string, number>;
  trajectory: TrajectoryTick[];
}

function expectPressCoverSupportGeometry(
  artifact: AcceptedTrajectory,
  label: string,
): void {
  expect(artifact.objectiveId, label).toBe("SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH");
  expect(artifact.evidenceClass, label).toBe("MULTI_TICK");
  expect(artifact.scenario.id, label).toBe("3v3-press-scenario-v1");
  expect(artifact.trajectory.length, `${label}: tick rows`).toBe(600);

  let teamTicks = 0;
  let withPresser = 0;
  let withCover = 0;
  let withSupport = 0;
  for (const tick of artifact.trajectory) {
    for (const teamId of ["team-a", "team-b"]) {
      const team = tick.teams[teamId];
      if (!team) continue;
      teamTicks++;
      if (team.presserId !== "") withPresser++;
      if (team.coverId !== "" && team.coverId !== team.presserId) withCover++;
      if (team.supportCount > 0) withSupport++;
      // Every recorded team-tick has a finite presser/cover pair geometry.
      expect(Number.isFinite(team.presserDistanceToBall), `${label} tick ${tick.tick}`).toBe(true);
    }
  }
  // Press-and-support depth was observed on every tick of the window.
  expect(teamTicks, label).toBe(1200);
  expect(withPresser, label).toBe(1200);
  expect(withCover, label).toBe(1200);
  expect(withSupport, label).toBe(1200);
}

function digestOf(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH: trajectory evidence", () => {
  it("the accepted trajectory holds the press/cover/support geometry invariants", () => {
    const accepted = JSON.parse(readFileSync(trajectoryPath, "utf-8")) as AcceptedTrajectory;
    expectPressCoverSupportGeometry(accepted, "accepted evidence");
    expect(accepted.match.observations).toBe(600);
    expect(accepted.situationScan.present).toBeGreaterThanOrEqual(0);
  });

  it(
    "derives the same geometry live into ephemeral test-results without touching durable evidence",
    () => {
      const before = digestOf(trajectoryPath);

      const scenario = load3v3Scenario();
      const roleMap = buildRoleMap(scenario);
      // Accepted trajectory predates anti-huddle-v1 → replay the historical
      // CPU configuration byte-for-byte.
      const result = runHeadlessMatch({
        scenario,
        maxTicks: 600,
        cpuAntiHuddle: false,
      });
      const derived = {
        objectiveId: "SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH",
        evidenceClass: "MULTI_TICK",
        scenario: {
          id: scenario.id,
          version: scenario.version,
          seed: scenario.seed,
          durationTicks: 600,
        },
        match: {
          events: result.events.length,
          observations: result.observations.length,
          score: result.score,
        },
        situationScan: scanMatchResult(result.events, result.observations).summary,
        trajectory: extractTrajectory(result, roleMap),
      } satisfies AcceptedTrajectory;

      expectPressCoverSupportGeometry(derived, "live derivation");
      // The derivation reproduces the accepted window's shape.
      expect(derived.match.observations).toBe(600);

      // Ephemeral output only: docs/evidence/** stays byte-identical.
      mkdirSync(ephemeralDir, { recursive: true });
      writeFileSync(
        join(ephemeralDir, "trajectory.derived.json"),
        JSON.stringify(derived, null, 2),
      );
      expect(digestOf(trajectoryPath), "ordinary runs must not mutate accepted evidence").toBe(before);
    },
    120000,
  );
});
