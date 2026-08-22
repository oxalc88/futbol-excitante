/**
 * @module @pes/eval/runners/team-decision-eval-runner
 *
 * Standalone Node runner that exercises the team-decision profile
 * (`computeTeamDecision`, `getBallZone`, `teamHasPossession`) against
 * a suite of scenarios and persists the structured result as
 * `docs/evidence/TEAM_DECISION_PROFILE/eval.json`.
 *
 * This is the executable evidence producer for the
 * TEAM_DECISION_PROFILE entry prerequisite.
 *
 * Node I/O is allowed in the eval layer.
 * No Math.random, Date, DOM, or Node I/O in src/simulation or src/contracts.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  computeTeamDecision,
  getBallZone,
  teamHasPossession,
} from "../../src/adapters/input-browser/team-decision-profile.js";
import type { CpuObservation } from "../../src/adapters/input-browser/cpu-adapter.js";
import type { TeamStrategy, DefensiveSubMode } from "../../src/adapters/input-browser/team-decision-profile.js";
import type { EvaluationOutcome } from "../contracts/types.js";

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

const DEFAULT_PITCH: { length: number; width: number } = { length: 105, width: 68 };

interface Fixture {
  name: string;
  ballX: number;
  ballY: number;
  ballZ: number;
  ballHSpeed: number;
  players: Array<{ playerId: string; teamId: string; x: number; y: number }>;
  scoreDifferential?: number;
  matchPhase?: CpuObservation["matchPhase"];
  teamId: string;
  expectedStrategy: TeamStrategy;
  expectedDefensiveSubMode: DefensiveSubMode;
  expectedBallZone: "own" | "center" | "opponent";
  expectedHasPossession: boolean;
}

function makeObservation(f: Fixture): CpuObservation {
  return {
    players: f.players.map((p) => ({
      playerId: p.playerId,
      teamId: p.teamId,
      groundPosition: { x: p.x, y: p.y },
      linearVelocity: { x: 0, y: 0 },
      bodyHeading: 0,
    })),
    ball: {
      position: { x: f.ballX, y: f.ballY, z: f.ballZ },
      linearVelocity: { x: f.ballHSpeed, y: 0, z: 0 },
      regime: "ground-roll",
    },
    pitchLength: DEFAULT_PITCH.length,
    pitchWidth: DEFAULT_PITCH.width,
    cpuTeamId: f.teamId,
    scoreDifferential: f.scoreDifferential,
    matchPhase: f.matchPhase,
  };
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AxisResult {
  axis_id: string;
  description: string;
  outcome: EvaluationOutcome;
  evidence: string[];
}

export interface TeamDecisionEvalResult {
  profileVersion: string;
  axes: AxisResult[];
  overall: EvaluationOutcome;
  milestoneVerdict: EvaluationOutcome;
}

// ---------------------------------------------------------------------------
// Individual axis evaluators
// ---------------------------------------------------------------------------

/**
 * Verify `getBallZone` across multiple ball positions.
 */
function evaluateBallZone(): AxisResult {
  const evidence: string[] = [];
  let allPass = true;

  const tests: Array<{
    ballX: number;
    teamId: string;
    expected: "own" | "center" | "opponent";
  }> = [
    // team-a attacks +x, own goal at -x.
    { ballX: -30, teamId: "team-a", expected: "own" },
    { ballX: 0, teamId: "team-a", expected: "center" },
    { ballX: 30, teamId: "team-a", expected: "opponent" },
    // team-b attacks -x, own goal at +x.
    { ballX: 30, teamId: "team-b", expected: "own" },
    { ballX: 0, teamId: "team-b", expected: "center" },
    { ballX: -30, teamId: "team-b", expected: "opponent" },
    // Edge: just inside boundary (strict < / > means exact boundary is center).
    { ballX: -17.6, teamId: "team-a", expected: "own" },
    { ballX: 17.6, teamId: "team-a", expected: "opponent" },
  ];

  for (const t of tests) {
    const result = getBallZone(t.ballX, DEFAULT_PITCH.length, t.teamId);
    const ok = result === t.expected;
    if (!ok) allPass = false;
    evidence.push(
      `getBallZone(${t.ballX}, 105, "${t.teamId}") = ${result} (expected ${t.expected}) ${ok ? "PASS" : "FAIL"}`,
    );
  }

  return {
    axis_id: "ball-zone-detection",
    description: "Ball zone classification across both team perspectives and boundaries.",
    outcome: allPass ? "PASS" : "FAIL",
    evidence,
  };
}

/**
 * Verify `teamHasPossession` with various distances and speeds.
 */
function evaluatePossession(): AxisResult {
  const evidence: string[] = [];
  let allPass = true;

  // Scenario 1: player within possession range, slow ball → true
  const obs1 = makeObservation({
    name: "possession-close-slow",
    ballX: 1, ballY: 0, ballZ: 0, ballHSpeed: 0,
    players: [
      { playerId: "p1", teamId: "team-a", x: 0, y: 0 },
    ],
    matchPhase: "playing",
    teamId: "team-a",
    expectedStrategy: "ATTACK",
    expectedDefensiveSubMode: "NONE",
    expectedBallZone: "opponent",
    expectedHasPossession: true,
  });
  const r1 = teamHasPossession(obs1, "team-a");
  const ok1 = r1 === true;
  if (!ok1) allPass = false;
  evidence.push(`Possession close ball (dist≈1m, speed=0): ${r1} ${ok1 ? "PASS" : "FAIL"}`);

  // Scenario 2: player far from ball → false
  const obs2 = makeObservation({
    name: "possession-far",
    ballX: 30, ballY: 0, ballZ: 0, ballHSpeed: 0,
    players: [
      { playerId: "p1", teamId: "team-a", x: 0, y: 0 },
    ],
    matchPhase: "playing",
    teamId: "team-a",
    expectedStrategy: "BALANCED",
    expectedDefensiveSubMode: "NONE",
    expectedBallZone: "opponent",
    expectedHasPossession: false,
  });
  const r2 = teamHasPossession(obs2, "team-a");
  const ok2 = r2 === false;
  if (!ok2) allPass = false;
  evidence.push(`Possession far ball (dist≈30m, speed=0): ${r2} ${ok2 ? "PASS" : "FAIL"}`);

  // Scenario 3: player close but ball moving fast → false
  const obs3 = makeObservation({
    name: "possession-close-fast",
    ballX: 1, ballY: 0, ballZ: 0, ballHSpeed: 5,
    players: [
      { playerId: "p1", teamId: "team-a", x: 0, y: 0 },
    ],
    matchPhase: "playing",
    teamId: "team-a",
    expectedStrategy: "BALANCED",
    expectedDefensiveSubMode: "NONE",
    expectedBallZone: "opponent",
    expectedHasPossession: false,
  });
  const r3 = teamHasPossession(obs3, "team-a");
  const ok3 = r3 === false;
  if (!ok3) allPass = false;
  evidence.push(`Possession close ball but fast (dist≈1m, speed=5): ${r3} ${ok3 ? "PASS" : "FAIL"}`);

  return {
    axis_id: "possession-detection",
    description:
      "Possession detection: player within 2m of slow ball, distance rejection, speed rejection.",
    outcome: allPass ? "PASS" : "FAIL",
    evidence,
  };
}

/**
 * Verify strategy selection across all primary scenarios.
 */
function evaluateStrategy(): AxisResult {
  const evidence: string[] = [];
  let allPass = true;

  const scenarios: Fixture[] = [
    // ATTACK: own possession in opponent third.
    {
      name: "attack-opponent-third",
      ballX: 30, ballY: 0, ballZ: 0, ballHSpeed: 0,
      players: [
        { playerId: "p1", teamId: "team-a", x: 29, y: 0 }, // near ball → possession
        { playerId: "p2", teamId: "team-a", x: -5, y: 5 },
        { playerId: "p3", teamId: "team-b", x: 10, y: 0 },
        { playerId: "p4", teamId: "team-b", x: 15, y: -5 },
      ],
      matchPhase: "playing",
      teamId: "team-a",
      expectedStrategy: "ATTACK",
      expectedDefensiveSubMode: "NONE",
      expectedBallZone: "opponent",
      expectedHasPossession: true,
    },
    // DEFEND: opponent possession in own third.
    {
      name: "defend-own-third",
      ballX: -30, ballY: 0, ballZ: 0, ballHSpeed: 0,
      players: [
        { playerId: "p1", teamId: "team-a", x: -20, y: 5 },
        { playerId: "p2", teamId: "team-a", x: -15, y: -5 },
        { playerId: "p3", teamId: "team-b", x: -29, y: 0 }, // opponent possession
      ],
      matchPhase: "playing",
      teamId: "team-a",
      expectedStrategy: "DEFEND",
      expectedDefensiveSubMode: "PRESSING", // opponent within 12m
      expectedBallZone: "own",
      expectedHasPossession: false,
    },
    // BALANCED: no clear possession, ball in center.
    {
      name: "balanced-center",
      ballX: 0, ballY: 0, ballZ: 0, ballHSpeed: 0,
      players: [
        { playerId: "p1", teamId: "team-a", x: -20, y: 10 },
        { playerId: "p2", teamId: "team-a", x: -15, y: -10 },
        { playerId: "p3", teamId: "team-b", x: 20, y: 10 },
        { playerId: "p4", teamId: "team-b", x: 15, y: -10 },
      ],
      matchPhase: "playing",
      teamId: "team-a",
      expectedStrategy: "BALANCED",
      expectedDefensiveSubMode: "NONE",
      expectedBallZone: "center",
      expectedHasPossession: false,
    },
    // BALANCED non-playing phase (goal) — player close to ball → possession.
    {
      name: "balanced-goal-phase",
      ballX: 0, ballY: 0, ballZ: 0, ballHSpeed: 0,
      players: [
        { playerId: "p1", teamId: "team-a", x: 1, y: 0 }, // 1m from ball → possession
      ],
      matchPhase: "goal",
      teamId: "team-a",
      expectedStrategy: "BALANCED",
      expectedDefensiveSubMode: "NONE",
      expectedBallZone: "center",
      expectedHasPossession: true,
    },
    // BALANCED kickoff.
    {
      name: "balanced-kickoff",
      ballX: 0, ballY: 0, ballZ: 0, ballHSpeed: 0,
      players: [
        { playerId: "p1", teamId: "team-a", x: 0, y: 0 },
      ],
      matchPhase: "kickoff",
      teamId: "team-a",
      expectedStrategy: "BALANCED",
      expectedDefensiveSubMode: "NONE",
      expectedBallZone: "center",
      expectedHasPossession: true,
    },
    // DEFEND by score gradient: behind by 3+ → ATTACK in center.
    {
      name: "attack-by-score",
      ballX: 0, ballY: 0, ballZ: 0, ballHSpeed: 0,
      players: [
        { playerId: "p1", teamId: "team-a", x: -20, y: 10 },
        { playerId: "p2", teamId: "team-a", x: -15, y: -10 },
        { playerId: "p3", teamId: "team-b", x: 20, y: 10 },
        { playerId: "p4", teamId: "team-b", x: 15, y: -10 },
      ],
      scoreDifferential: -3,
      matchPhase: "playing",
      teamId: "team-a",
      expectedStrategy: "ATTACK",
      expectedDefensiveSubMode: "NONE",
      expectedBallZone: "center",
      expectedHasPossession: false,
    },
    // DEFEND by score gradient: ahead by 3+ → DEFEND in center.
    {
      name: "defend-by-score",
      ballX: 0, ballY: 0, ballZ: 0, ballHSpeed: 0,
      players: [
        { playerId: "p1", teamId: "team-a", x: -20, y: 10 }, // ~22m from ball → MARKING
        { playerId: "p2", teamId: "team-a", x: -15, y: -10 },
        { playerId: "p3", teamId: "team-b", x: 20, y: 10 },
        { playerId: "p4", teamId: "team-b", x: 15, y: -10 },
      ],
      scoreDifferential: 3,
      matchPhase: "playing",
      teamId: "team-a",
      expectedStrategy: "DEFEND",
      expectedDefensiveSubMode: "MARKING",
      expectedBallZone: "center",
      expectedHasPossession: false,
    },
  ];

  for (const f of scenarios) {
    const obs = makeObservation(f);
    const result = computeTeamDecision(obs, f.teamId);

    const strategyOk = result.strategy === f.expectedStrategy;
    const subModeOk = result.defensiveSubMode === f.expectedDefensiveSubMode;
    const zoneOk = result.ballZone === f.expectedBallZone;
    const possOk = result.hasPossession === f.expectedHasPossession;
    const allOk = strategyOk && subModeOk && zoneOk && possOk;

    if (!allOk) allPass = false;

    evidence.push(
      `${f.name}: strategy=${result.strategy}(${strategyOk ? "✓" : "✗"}) ` +
      `subMode=${result.defensiveSubMode}(${subModeOk ? "✓" : "✗"}) ` +
      `zone=${result.ballZone}(${zoneOk ? "✓" : "✗"}) ` +
      `possession=${result.hasPossession}(${possOk ? "✓" : "✗"})`,
    );
  }

  return {
    axis_id: "strategy-selection",
    description:
      "Strategy selection: ATTACK on possession, DEFEND on opponent possession in own third, " +
      "BALANCED default, score-gradient bias, non-playing phases.",
    outcome: allPass ? "PASS" : "FAIL",
    evidence,
  };
}

/**
 * Verify determinism: same observation → same TeamDecision output.
 */
function evaluateDeterminism(): AxisResult {
  const evidence: string[] = [];
  let allPass = true;

  const obs = makeObservation({
    name: "determinism-check",
    ballX: 25, ballY: 5, ballZ: 0, ballHSpeed: 0,
    players: [
      { playerId: "p1", teamId: "team-a", x: 24, y: 5 },
      { playerId: "p2", teamId: "team-a", x: -10, y: 10 },
      { playerId: "p3", teamId: "team-b", x: -20, y: -5 },
      { playerId: "p4", teamId: "team-b", x: -25, y: 10 },
    ],
    matchPhase: "playing",
    teamId: "team-a",
    expectedStrategy: "ATTACK",
    expectedDefensiveSubMode: "NONE",
    expectedBallZone: "opponent",
    expectedHasPossession: true,
  });

  const d1 = computeTeamDecision(obs, "team-a");
  const d2 = computeTeamDecision(obs, "team-a");
  const d3 = computeTeamDecision(obs, "team-a");

  const same12 = JSON.stringify(d1) === JSON.stringify(d2);
  const same23 = JSON.stringify(d2) === JSON.stringify(d3);
  if (!same12 || !same23) allPass = false;

  evidence.push(
    `Three runs: d1=d2=${same12}, d2=d3=${same23} ${same12 && same23 ? "PASS" : "FAIL"}`,
  );
  evidence.push(
    `decision: strategy=${d1.strategy} subMode=${d1.defensiveSubMode} zone=${d1.ballZone} poss=${d1.hasPossession}`,
  );

  return {
    axis_id: "determinism",
    description: "Identical observation produces byte-identical TeamDecision across multiple calls.",
    outcome: allPass ? "PASS" : "FAIL",
    evidence,
  };
}

/**
 * Verify defensive sub-mode assignment under DEFEND strategy.
 */
function evaluateDefensiveSubMode(): AxisResult {
  const evidence: string[] = [];
  let allPass = true;

  // PRESSING: ball in own third (< -17.5 for team-a), nearest defender close (< 12m).
  const obsPress = makeObservation({
    name: "defensive-pressing",
    ballX: -20, ballY: 0, ballZ: 0, ballHSpeed: 0,
    players: [
      { playerId: "p1", teamId: "team-a", x: -23, y: 0 }, // 3m from ball → pressing
      { playerId: "p2", teamId: "team-a", x: -15, y: 5 },
      { playerId: "p3", teamId: "team-b", x: -20, y: 0 }, // opponent has ball
    ],
    matchPhase: "playing",
    teamId: "team-a",
    expectedStrategy: "DEFEND",
    expectedDefensiveSubMode: "PRESSING",
    expectedBallZone: "own",
    expectedHasPossession: false,
  });

  // MARKING: ball in own third (< -17.5 for team-a), all teammates far (> 12m).
  const obsMark = makeObservation({
    name: "defensive-marking",
    ballX: -20, ballY: 0, ballZ: 0, ballHSpeed: 0,
    players: [
      { playerId: "p1", teamId: "team-a", x: -35, y: 0 }, // 15m from ball → marking
      { playerId: "p2", teamId: "team-a", x: -40, y: 5 }, // 20m from ball
      { playerId: "p3", teamId: "team-b", x: -20, y: 0 }, // opponent has ball
    ],
    matchPhase: "playing",
    teamId: "team-a",
    expectedStrategy: "DEFEND",
    expectedDefensiveSubMode: "MARKING",
    expectedBallZone: "own",
    expectedHasPossession: false,
  });

  const expectedSubModes: DefensiveSubMode[] = ["PRESSING", "MARKING"];

  for (const i of [0, 1]) {
    const f = [obsPress, obsMark][i]!;
    const expectedSubMode = expectedSubModes[i];
    const result = computeTeamDecision(f, "team-a");
    const ok = result.defensiveSubMode === expectedSubMode;
    if (!ok) allPass = false;
    evidence.push(
      `subMode=${result.defensiveSubMode} (expected ${expectedSubMode}) ${ok ? "PASS" : "FAIL"}`,
    );
  }

  return {
    axis_id: "defensive-sub-mode",
    description:
      "Defensive sub-mode: PRESSING when nearest defender within 12m, " +
      "MARKING when farther, NONE when attacking.",
    outcome: allPass ? "PASS" : "FAIL",
    evidence,
  };
}

/**
 * Verify set-piece phases produce BALANCED/NONE.
 */
function evaluateSetPieces(): AxisResult {
  const evidence: string[] = [];
  let allPass = true;

  const phases: CpuObservation["matchPhase"][] = [
    "goal", "halftime", "fulltime",
    "corner-kick", "throw-in", "goal-kick",
  ];

  for (const phase of phases) {
    const obs = makeObservation({
      name: `setpiece-${phase}`,
      ballX: 0, ballY: 0, ballZ: 0, ballHSpeed: 0,
      players: [
        { playerId: "p1", teamId: "team-a", x: 5, y: 0 },
        { playerId: "p2", teamId: "team-b", x: -5, y: 0 },
      ],
      matchPhase: phase,
      teamId: "team-a",
      expectedStrategy: "BALANCED",
      expectedDefensiveSubMode: "NONE",
      expectedBallZone: "center",
      expectedHasPossession: true,
    });

    const result = computeTeamDecision(obs, "team-a");
    const strategyOk = result.strategy === "BALANCED";
    const subModeOk = result.defensiveSubMode === "NONE";
    const ok = strategyOk && subModeOk;
    if (!ok) allPass = false;

    evidence.push(
      `Set-piece "${phase}": strategy=${result.strategy}(${strategyOk ? "✓" : "✗"}) ` +
      `subMode=${result.defensiveSubMode}(${subModeOk ? "✓" : "✗"})`,
    );
  }

  return {
    axis_id: "set-piece-phases",
    description:
      "Non-playing phases (goal, halftime, fulltime, corner-kick, throw-in, goal-kick) " +
      "produce BALANCED strategy with NONE sub-mode.",
    outcome: allPass ? "PASS" : "FAIL",
    evidence,
  };
}

// ---------------------------------------------------------------------------
// Main evaluation
// ---------------------------------------------------------------------------

/**
 * Run the team-decision profile evaluation.
 *
 * Exercises the three public functions (computeTeamDecision, getBallZone,
 * teamHasPossession) against a suite of scenarios covering:
 * - ball zone classification
 * - possession detection
 * - strategy selection (ATTACK/DEFEND/BALANCED)
 * - defensive sub-mode assignment
 * - determinism
 * - set-piece phases
 *
 * @returns TeamDecisionEvalResult with per-axis verdicts.
 */
export function runTeamDecisionEval(): TeamDecisionEvalResult {
  const axes: AxisResult[] = [
    evaluateBallZone(),
    evaluatePossession(),
    evaluateStrategy(),
    evaluateDeterminism(),
    evaluateDefensiveSubMode(),
    evaluateSetPieces(),
  ];

  // Reduce: overall is PASS if all axes PASS, FAIL if any FAIL,
  // NOT_EVALUATED only if axes array is empty (shouldn't happen).
  const outcomes = axes.map((a) => a.outcome);
  let overall: EvaluationOutcome;
  if (axes.length === 0) {
    overall = "NOT_EVALUATED";
  } else if (outcomes.includes("FAIL")) {
    overall = "FAIL";
  } else if (outcomes.every((o) => o === "PASS")) {
    overall = "PASS";
  } else {
    overall = "NOT_EVALUATED";
  }

  return {
    profileVersion: "team-decision-profile-v1",
    axes,
    overall,
    milestoneVerdict: overall,
  };
}

/**
 * Run the evaluation and persist eval.json.
 *
 * @param outputDir - Directory to write eval.json into.
 * @returns The evaluation result.
 */
export function runAndPersist(outputDir: string): TeamDecisionEvalResult {
  const result = runTeamDecisionEval();

  // Persist with milestoneVerdict.
  const output = {
    ...result,
    milestoneVerdict: result.milestoneVerdict,
  } as TeamDecisionEvalResult;

  mkdirSync(outputDir, { recursive: true });
  const evalPath = join(outputDir, "eval.json");
  writeFileSync(evalPath, JSON.stringify(output, null, 2), "utf-8");

  console.error(
    `[team-decision-runner] overall: ${output.overall}`,
  );
  console.error(
    `[team-decision-runner] milestoneVerdict: ${output.milestoneVerdict}`,
  );
  console.error(
    `[team-decision-runner] axes: ${output.axes.length}`,
  );
  for (const axis of output.axes) {
    console.error(
      `  [team-decision-runner] axis ${axis.axis_id}: ${axis.outcome}`,
    );
  }

  return output;
}

/**
 * CLI entry point.
 *
 * Usage:
 *   tsx eval/runners/team-decision-eval-runner.ts [output-dir]
 */
export function main(): ReturnType<typeof runAndPersist> {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  const outputDir =
    process.argv[2] ??
    join(__dirname, "../../docs/evidence/TEAM_DECISION_PROFILE");

  console.error(
    `[team-decision-runner] Output dir: ${outputDir}`,
  );

  return runAndPersist(outputDir);
}

// Run if executed directly.
if (process.argv[1]?.endsWith("team-decision-eval-runner.ts")) {
  const result = main();
  process.exit(result.overall === "PASS" ? 0 : 1);
}