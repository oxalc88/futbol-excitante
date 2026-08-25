/**
 * @module tests/unit/eval/SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH-2-trajectory
 *
 * Generates team-geometry trajectory evidence for the MULTI_TICK
 * evidence class.  Runs a 3v3 match, extracts per-tick geometry,
 * and writes trajectory.json.
 *
 * Also generates the match events + observations for scanner analysis.
 *
 * No Math.random, Date, DOM, or Node I/O in simulation core.
 * Node I/O is allowed here (evidence writing).
 */

import { describe, it } from "vitest";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runHeadlessMatch } from "../../../eval/runners/headless-match.js";
import { scanMatchResult } from "../../../eval/runners/small-sided-match-situation-scanner.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";
import type { HeadlessMatchResult } from "../../../eval/runners/headless-match.js";

const __testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__testDir, "../../..");
const evidenceDir = join(projectRoot, "docs/evidence/SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH");

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

describe("SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH: trajectory generation", () => {
  it("generates trajectory.json from 3v3 match", () => {
    const scenario = load3v3Scenario();
    const roleMap = buildRoleMap(scenario);
    const result = runHeadlessMatch({ scenario, maxTicks: 600 });
    const trajectory = extractTrajectory(result, roleMap);
    const scan = scanMatchResult(result.events, result.observations);

    mkdirSync(evidenceDir, { recursive: true });

    const output = {
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
      situationScan: scan.summary,
      trajectory,
    };

    writeFileSync(
      join(evidenceDir, "trajectory.json"),
      JSON.stringify(output, null, 2),
    );
  }, 120000);
});
