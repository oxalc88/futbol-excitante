/**
 * @module tests/unit/eval/corner-driven-conformance-binding.test.ts
 *
 * Evidence-binding test for CORNER-DRIVEN-CONFORMANCE.
 *
 * Locks the honest published corner-driven verdict table produced by re-running
 * the registered `rules` evaluator (`evaluateSuite("rules", ...)`) over the
 * driven corner stream with the gated `serializeRestartFacts` observation
 * extension:
 *
 *   - rules-corner-live (5v5-corner-driven, 400 ticks): the core genuinely
 *     awards and executes a corner kick (defending-team last touch over the +x
 *     goal line outside the posts), so MATCH-CORNER-KICK-AWARD / -PLACEMENT /
 *     -TIMER-FREEZE are honestly PASS; -CROSS stays BLOCKED_MISSING_REFERENCE.
 *   - rules-corner-stashed (gated off): the stash-identity control, byte-identical
 *     state-hash chain, no injected facts.
 *   - rules-corner-goalkick-neighbour (5v5-restart-arc): the discriminating
 *     control — a goal-kick-only stream returns the corner criteria
 *     NOT_EVALUATED, proving the corner PASS is not a blanket PASS.
 *
 * It pins:
 *  1. The record shape and a stable, byte-reproducible `record_sha256`.
 *  2. The corner cluster verdicts (AWARD / PLACEMENT / TIMER-FREEZE PASS, CROSS
 *     BLOCKED_MISSING_REFERENCE).
 *  3. The stash-identity control (identical state-hash chain, no injected facts).
 *  4. The discriminating goal-kick neighbour control (corner criteria
 *     NOT_EVALUATED, goal-kick criteria PASS).
 *  5. The record is not hand-written: reproducing the driven corner run through
 *     the production runner + evaluator yields the pinned corner verdicts.
 *  6. No PROMOTION / PES fidelity / FOUNDATION_LAB_PASS / suite-level PASS
 *     claim is recorded; no invented reference (CROSS stays BLOCKED).
 *
 * Node I/O is allowed for scenario and artifact loading.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runHeadlessMatch } from "../../../eval/runners/headless-match.js";
import { evaluateSuite } from "../../../eval/runners/foundation-evaluator.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";
import type { TelemetryObservation } from "../../../src/contracts/telemetry.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const STATE_PATH = join(
  projectRoot,
  "docs/evidence/CORNER-DRIVEN-CONFORMANCE/corner-driven-state.json",
);

interface CornerRecord {
  schema_version: number;
  objective_id: string;
  suite_id: string;
  suite_version: string;
  evidence_class: string;
  lifecycle_phase_sync: string;
  record_sha256: string;
  runs: Array<{
    id: string;
    scenario: string;
    ticks: number;
    gated_serialization: boolean;
    reproduction: string;
    executed_restart_counts: Record<string, number>;
    verdicts: Record<string, string>;
    determinism: { state_hash_of_hashes: string; final_state_hash: string };
    stash_identity?: {
      injected_core_match_phase_events: number;
      gated_on_state_hash_of_hashes?: string;
      state_hash_chain_identical?: boolean;
    };
  }>;
  by_criterion: Record<string, string[]>;
  verdict_summary: Record<string, string>;
  criterion_reasons: Record<string, string>;
  claims_not_made: string[];
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(projectRoot, relativePath), "utf-8")) as T;
}

function loadScenario(relativePath: string): ScenarioDefinition {
  return JSON.parse(
    readFileSync(join(projectRoot, relativePath), "utf-8"),
  ) as ScenarioDefinition;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function criterionOutcomes(observations: TelemetryObservation[]): Record<string, string> {
  const suite = evaluateSuite("rules", observations);
  const out: Record<string, string> = {};
  for (const t of suite.tests) for (const c of t.criteria) out[c.criterion_id] = c.outcome;
  return out;
}

function loadRecord(): CornerRecord {
  return readJson<CornerRecord>(
    "docs/evidence/CORNER-DRIVEN-CONFORMANCE/corner-driven-state.json",
  );
}

describe("CORNER-DRIVEN-CONFORMANCE corner-driven verdict record", () => {
  it("durable record exists with the established shape", () => {
    const record = loadRecord();
    expect(record.objective_id).toBe("CORNER-DRIVEN-CONFORMANCE");
    expect(record.suite_id).toBe("rules");
    expect(record.suite_version).toBe("suite-rules-v1");
    expect(record.evidence_class).toBe("MULTI_TICK");
    expect(record.schema_version).toBe(1);
    expect(record.lifecycle_phase_sync).toBe("core-owned");
    expect(typeof record.record_sha256).toBe("string");
    expect(record.record_sha256.length).toBeGreaterThan(0);
    expect(record.runs.length).toBe(3);
    expect(record.claims_not_made.length).toBeGreaterThan(0);
  });

  it("record_sha256 is byte-reproducible (no wall-clock field, recomputes to the pinned value)", () => {
    const record = loadRecord();
    const copy: Record<string, unknown> = { ...record };
    delete copy.record_sha256;
    expect(sha256(JSON.stringify(copy))).toBe(record.record_sha256);
  });

  it("the corner cluster evaluates honestly: AWARD / PLACEMENT / TIMER-FREEZE PASS, CROSS BLOCKED", () => {
    const record = loadRecord();
    expect(record.verdict_summary["MATCH-CORNER-KICK-AWARD"]).toBe("PASS");
    expect(record.verdict_summary["MATCH-CORNER-KICK-PLACEMENT"]).toBe("PASS");
    expect(record.verdict_summary["MATCH-CORNER-KICK-TIMER-FREEZE"]).toBe("PASS");
    expect(record.verdict_summary["MATCH-CORNER-KICK-CROSS"]).toBe("BLOCKED_MISSING_REFERENCE");
  });

  it("stash-identity: the gated and stashed runs share identical state-hash chains (injection is hash-neutral)", () => {
    const record = loadRecord();
    const live = record.runs.find((r) => r.id === "rules-corner-live");
    const stashed = record.runs.find((r) => r.id === "rules-corner-stashed");
    expect(live).toBeDefined();
    expect(stashed).toBeDefined();
    expect(stashed!.stash_identity?.state_hash_chain_identical).toBe(true);
    expect(stashed!.stash_identity?.injected_core_match_phase_events).toBe(0);
    expect(stashed!.stash_identity?.injected_restart_executed_events).toBe(0);
    expect(stashed!.stash_identity?.gated_on_state_hash_of_hashes).toBe(live!.determinism.state_hash_of_hashes);
    expect(stashed!.determinism.state_hash_of_hashes).toBe(live!.determinism.state_hash_of_hashes);
    // The corner execution is genuinely observed only on the gated stream.
    expect(live!.executed_restart_counts.corner).toBe(1);
    expect(stashed!.executed_restart_counts.corner).toBe(0);
  });

  it("discriminating: the goal-kick neighbour control returns the corner criteria NOT_EVALUATED", () => {
    const record = loadRecord();
    const neighbour = record.runs.find((r) => r.id === "rules-corner-goalkick-neighbour");
    expect(neighbour).toBeDefined();
    expect(neighbour!.executed_restart_counts.corner).toBe(0);
    expect(neighbour!.executed_restart_counts["goal-kick"]).toBe(1);
    expect(neighbour!.verdicts["MATCH-CORNER-KICK-AWARD"]).toBe("NOT_EVALUATED");
    expect(neighbour!.verdicts["MATCH-CORNER-KICK-PLACEMENT"]).toBe("NOT_EVALUATED");
    expect(neighbour!.verdicts["MATCH-CORNER-KICK-TIMER-FREEZE"]).toBe("NOT_EVALUATED");
    expect(neighbour!.verdicts["MATCH-GOAL-KICK-AWARD"]).toBe("PASS");
  });

  it("record does not claim PROMOTION / PES fidelity / FOUNDATION_LAB_PASS / suite-level PASS", () => {
    const record = loadRecord();
    const joined = record.claims_not_made.join("\n").toLowerCase();
    expect(joined).toContain("no suite-level pass");
    expect(joined).toContain("no promotion");
    expect(joined).toContain("no pes");
    expect(joined).toContain("no foundation_lab_pass");
    expect(joined).toContain("no invented reference");
    expect(joined).toContain("cross");
  });

  it(
    "record is not hand-written: reproducing the driven corner run yields the pinned corner verdicts",
    () => {
      const corner = runHeadlessMatch({
        scenario: loadScenario("eval/scenarios/5v5-corner-driven.v1.json"),
        maxTicks: 400,
        cpuAntiHuddle: true,
        lifecyclePhaseSync: "core-owned",
        serializeRestartFacts: true,
      });
      const out = criterionOutcomes(corner.observations);
      expect(out["MATCH-CORNER-KICK-AWARD"]).toBe("PASS");
      expect(out["MATCH-CORNER-KICK-PLACEMENT"]).toBe("PASS");
      expect(out["MATCH-CORNER-KICK-TIMER-FREEZE"]).toBe("PASS");
      expect(out["MATCH-CORNER-KICK-CROSS"]).toBe("BLOCKED_MISSING_REFERENCE");
    },
    180_000,
  );
});
