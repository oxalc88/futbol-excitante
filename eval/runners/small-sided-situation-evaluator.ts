/**
 * @module eval/runners/small-sided-situation-evaluator
 *
 * SMALL-SIDED-SITUATION-EVALUATOR: runs the situation/transition fixtures,
 * collects per-tick observations + events + team geometry, associates them
 * with the 8 mapped situations via situation-mapping, and writes structured
 * evidence artifacts per situation.
 *
 * Evidence verdict per situation:
 *   - PASS   : at least one required event kind appeared AND at least one
 *              indicative event kind appeared (or the situation has no
 *              indicative kinds and only required kinds appeared).
 *   - FAIL   : a required event kind appeared but no indicative kinds for a
 *              situation that defines indicative kinds.
 *   - NOT_EVALUATED : no relevant events/observations for this situation.
 *
 * Node I/O is allowed in the eval layer.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { SimulationEvent } from "../../src/contracts/scenario.js";

import { evaluate } from "./evaluate.js";
// Import wire.ts to register all built-in oracles in the protected registry.
import "../oracles/wire.js";
import {
  isRelevantEvent,
  filterEventsForSituation,
  filterObservationsForSituation,
  SITUATION_EVIDENCE_REQUIREMENTS,
  MAPPED_SITUATION_IDS,
  getSituationEvidence,
  type SituationEvidenceRequirement,
} from "../contracts/situation-mapping.js";

import type { ScenarioDefinition } from "../../src/contracts/scenario.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Per-situation evidence artifact.
 */
export interface SituationEvidenceArtifact {
  /** Situation ID. */
  situation_id: string;
  /** Evidence requirement record for this situation. */
  evidence_requirement: SituationEvidenceRequirement;
  /** Verdict for this situation: PASS, FAIL, or NOT_EVALUATED. */
  verdict: "PASS" | "FAIL" | "NOT_EVALUATED";
  /** Verdict explanation. */
  verdict_reason: string;
  /** Events relevant to this situation. */
  relevant_events: Array<{
    tick: number;
    id: string;
    kind: string;
    label: string;
  }>;
  /** Observations relevant to this situation. */
  relevant_observations: Array<{
    tick: number;
    event_count: number;
  }>;
  /** Team geometry snapshots (position of each player per tick). */
  team_geometry: Array<{
    tick: number;
    players: Array<{
      playerId: string;
      teamId: string;
      position: { x: number; y: number };
    }>;
  }>;
  /** All events from the run (for cross-reference). */
  all_events: Array<{
    tick: number;
    id: string;
    kind: string;
    label: string;
  }>;
  /** All observations from the run. */
  all_observations: Array<{
    tick: number;
    event_count: number;
  }>;
  /** Trajectory data: per-tick hashes + positions. */
  trajectory: TrajectoryEntry[];
  /** Whether any invariant failed during the run. */
  has_invariant_failures: boolean;
  /** Total ticks run. */
  total_ticks: number;
  /** Scenario ID. */
  scenario_id: string;
}

/**
 * A single trajectory entry (tick + hash + player positions).
 */
export interface TrajectoryEntry {
  tick: number;
  hash: string;
  players: Array<{
    playerId: string;
    teamId: string;
    position: { x: number; y: number };
  }>;
  ball: {
    position: { x: number; y: number; z: number };
    regime: string;
  };
}

/**
 * Full result for one fixture run.
 */
export interface SituationEvaluatorResult {
  /** Fixture name (e.g. "3v3-situation-fixture.v1.json"). */
  fixtureName: string;
  /** Scenario ID from the fixture. */
  scenarioId: string;
  /** Total ticks run. */
  totalTicks: number;
  /** PRNG seed used. */
  seed: number;
  /** All situation evidence artifacts. */
  situationArtifacts: SituationEvidenceArtifact[];
  /** Whether any invariant failed. */
  hasInvariantFailures: boolean;
  /** Final state hash. */
  finalStateHash: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Load a scenario fixture from eval/scenarios/.
 */
function loadFixture(name: string): ScenarioDefinition {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(__dirname, "../scenarios", name);
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as ScenarioDefinition;
}

/**
 * Build trajectory entries from an evaluation result.
 */
function buildTrajectory(
  evalResult: ReturnType<typeof evaluate>,
  scenario: ScenarioDefinition,
): TrajectoryEntry[] {
  const entries: TrajectoryEntry[] = [];
  const hashes = evalResult.hashes;
  const observations = evalResult.observations;

  for (const obs of observations) {
    const hash = hashes.get(obs.tick) ?? obs.stateHash;
    const playerPositions = obs.players.map((p) => ({
      playerId: p.playerId,
      teamId: p.teamId,
      position: { x: p.groundPosition.x, y: p.groundPosition.y },
    }));
    const ballEntry = {
      position: { x: obs.ball.position.x, y: obs.ball.position.y, z: obs.ball.position.z },
      regime: obs.ball.regime,
    };
    entries.push({ tick: obs.tick, hash, players: playerPositions, ball: ballEntry });
  }

  return entries;
}

/**
 * Lift a stripped event into a SimulationEvent-compatible shape so that
 * filterEventsForSituation can use it without payload errors.
 */
function toSimulationEvent(e: { tick: number; id: string; kind: string; label: string }): SimulationEvent {
  return { ...e, payload: {}, sequence: 0 } as SimulationEvent;
}

// Import the pure verdict function for local use.
import { computeSituationVerdict } from "./small-sided-situation-verdict.js";

// Re-export for downstream consumers.
export { computeSituationVerdict };

/**
 * Extract team geometry from observations.
 */
function extractTeamGeometry(observations: TelemetryObservation[]): TrajectoryEntry["team_geometry"] {
  return observations.map((obs) => ({
    tick: obs.tick,
    players: obs.players.map((p) => ({
      playerId: p.playerId,
      teamId: p.teamId,
      position: { x: p.groundPosition.x, y: p.groundPosition.y },
    })),
  }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the situation evaluator on a single fixture.
 *
 * @param fixtureName - Fixture filename (e.g. "3v3-situation-fixture.v1.json").
 * @param outputDir - Directory to write evidence artifacts. Defaults to
 *   `docs/evidence/SMALL-SIDED-SITUATION-EVALUATOR/situations/`.
 * @returns SituationEvaluatorResult.
 */
export function runSituationEvaluator(
  fixtureName: string,
  outputDir?: string,
): SituationEvaluatorResult {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  // Default output dir.
  const resolvedOutputDir = outputDir ?? join(__dirname, "../../docs/evidence/SMALL-SIDED-SITUATION-EVALUATOR/situations");

  // Load the fixture.
  const scenario = loadFixture(fixtureName);

  // Run the evaluation.
  const evalResult = evaluate({ scenario, safetyBounds: scenario.safetyBounds });

  // Build trajectory.
  const trajectory = buildTrajectory(evalResult, scenario);

  // Build team geometry.
  const teamGeometry = extractTeamGeometry(evalResult.observations);

  // Build per-situation artifacts.
  const situationArtifacts: SituationEvidenceArtifact[] = [];

  for (const situationId of MAPPED_SITUATION_IDS) {
    const requirement = getSituationEvidence(situationId);
    if (!requirement) continue;

    // Filter events and observations for this situation.
    // EvaluationResult.events is a stripped shape; lift to SimulationEvent
    // so the filter predicate (which reads event.kind) works.
    const liftedEvents = evalResult.events.map(toSimulationEvent);
    const relevantEvents = filterEventsForSituation(liftedEvents, situationId);
    const relevantObs = filterObservationsForSituation(evalResult.observations, situationId);

    // Compute verdict.
    const { verdict, reason } = computeSituationVerdict(situationId, relevantEvents, requirement);

    // Build trajectory for this situation (same trajectory as full run).
    const situationTrajectory = trajectory.map((entry) => ({
      ...entry,
      hash: entry.hash,
    }));

    const artifact: SituationEvidenceArtifact = {
      situation_id: situationId,
      evidence_requirement: requirement,
      verdict,
      verdict_reason: reason,
      relevant_events: relevantEvents.map((e) => ({
        tick: e.tick,
        id: e.id,
        kind: e.kind,
        label: e.label,
      })),
      relevant_observations: relevantObs.map((o) => ({
        tick: o.tick,
        event_count: o.events.length,
      })),
      team_geometry: teamGeometry,
      all_events: evalResult.events.map((e) => ({
        tick: e.tick,
        id: e.id,
        kind: e.kind,
        label: e.label,
      })),
      all_observations: evalResult.observations.map((o) => ({
        tick: o.tick,
        event_count: o.events.length,
      })),
      trajectory: situationTrajectory,
      has_invariant_failures: evalResult.hasInvariantFailures,
      total_ticks: evalResult.totalTicks,
      scenario_id: scenario.id,
    };

    situationArtifacts.push(artifact);
  }

  // Write per-situation artifacts to disk.
  mkdirSync(resolvedOutputDir, { recursive: true });
  for (const artifact of situationArtifacts) {
    const artifactPath = join(resolvedOutputDir, `${artifact.situation_id}.json`);
    writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), "utf-8");
  }

  // Write summary index.
  const summaryPath = join(resolvedOutputDir, "index.json");
  const summary = {
    fixtureName,
    scenarioId: scenario.id,
    totalTicks: evalResult.totalTicks,
    seed: scenario.seed,
    hasInvariantFailures: evalResult.hasInvariantFailures,
    finalStateHash: evalResult.finalStateHash,
    situationCount: situationArtifacts.length,
    situations: situationArtifacts.map((a) => ({
      situation_id: a.situation_id,
      verdict: a.verdict,
      relevant_event_count: a.relevant_events.length,
    })),
  };
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");

  return {
    fixtureName,
    scenarioId: scenario.id,
    totalTicks: evalResult.totalTicks,
    seed: scenario.seed,
    situationArtifacts,
    hasInvariantFailures: evalResult.hasInvariantFailures,
    finalStateHash: evalResult.finalStateHash,
  };
}

/**
 * Run the situation evaluator on all known fixtures.
 *
 * @param outputDir - Directory to write evidence artifacts.
 * @returns Array of SituationEvaluatorResult (one per fixture).
 */
export function runAllSituationFixtures(
  outputDir?: string,
): SituationEvaluatorResult[] {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const scenariosDir = join(__dirname, "../scenarios");

  // Discover situation fixtures.
  const fixtureNames: string[] = [];
  if (existsSync(scenariosDir)) {
    for (const f of readdirSync(scenariosDir)) {
      if (f.endsWith("-situation-fixture.v1.json") || f.endsWith("-transition-fixture.v1.json")) {
        fixtureNames.push(f);
      }
    }
  }

  const results: SituationEvaluatorResult[] = [];
  for (const name of fixtureNames) {
    console.error(`[small-sided-situation-evaluator] Running fixture: ${name}`);
    const result = runSituationEvaluator(name, outputDir);
    results.push(result);
    console.error(`[small-sided-situation-evaluator] Completed: ${name} — ${result.situationArtifacts.length} situations`);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Main (CLI entry point)
// ---------------------------------------------------------------------------

/**
 * CLI entry point.
 *
 * Usage:
 *   tsx eval/runners/small-sided-situation-evaluator.ts [fixture] [output-dir]
 */
export function main(): SituationEvaluatorResult {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  const fixtureName = process.argv[2] ?? "3v3-situation-fixture.v1.json";
  const outputDir = process.argv[3]
    ? join(process.cwd(), process.argv[3])
    : join(__dirname, "../../docs/evidence/SMALL-SIDED-SITUATION-EVALUATOR/situations");

  console.error(`[small-sided-situation-evaluator] Fixture: ${fixtureName}`);
  console.error(`[small-sided-situation-evaluator] Output dir: ${outputDir}`);

  return runSituationEvaluator(fixtureName, outputDir);
}

// Run if executed directly.
if (process.argv[1]?.endsWith("small-sided-situation-evaluator.ts")) {
  const result = main();
  process.exit(result.hasInvariantFailures ? 1 : 0);
}