/**
 * @module tests/unit/eval/GK-DRIVEN-CLOSURE-binding.test.ts
 *
 * Evidence-binding test for GK-DRIVEN-CLOSURE (Horizon v34, 4/4).
 *
 * Locks the honest goalkeepers-suite verdict table re-published over two DRIVEN
 * MULTI_TICK streams (adapter initial state / scenario fixtures only; zero
 * gameplay change — `git diff src/ src/contracts/` is EMPTY):
 *
 *   (a) 5v5-keeper-shot-fixture  -> GK-SAVE-CLAIM=PASS with >=1 real save/claim
 *       chain (4 keeper contacts inside the versioned reach, contact ticks
 *       362/374/380/386).
 *   (b) 5v5-keeper-release-fixture (NEW) -> GK-DISTRIBUTION-NO-OMNISCIENCE=PASS
 *       with >=1 real release (12 keeper-release telemetry events to observed
 *       forward teammate player-9).
 *
 * The aggregate verdict_counts stay 9/0/2/1/1 (both criteria were already PASS at
 * the aggregate baseline); the closure is at the driven-evidence / per-stream
 * level, answering the previously per-stream NOT_EVALUATED observations. The
 * BLOCKED_MISSING_REFERENCE key(s) and the NEEDS_PERCEPTUAL_REVIEW key stay
 * unchanged; no suite-level PASS claim is made.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runHeadlessMatch } from "../../../eval/runners/headless-match.js";
import { evaluateSuite } from "../../../eval/runners/foundation-evaluator.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const RECORD_PATH = join(
  projectRoot,
  "docs/evidence/GK-DRIVEN-CLOSURE/gk-driven-closure.json",
);

const GK_BEHAVIOR = [
  "GK-POSITIONING-HOLD",
  "GK-NO-FIELD-CHASE",
  "GK-SAVE-CLAIM",
  "GK-ROLE-DESIGNATION",
  "GK-DISTRIBUTION-NO-OMNISCIENCE",
] as const;

const COMMON = [
  "COMMON-FINITE",
  "COMMON-DETERMINISTIC",
  "COMMON-REFERENCES",
  "COMMON-BOUNDS",
] as const;

function loadScenario(relativePath: string): ScenarioDefinition {
  return JSON.parse(
    readFileSync(join(projectRoot, relativePath), "utf-8"),
  ) as ScenarioDefinition;
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(projectRoot, relativePath), "utf-8")) as T;
}

interface DrivenStream {
  stream_id: string;
  scenario: string;
  scenario_path: string;
  ticks: number;
  rehome_keeper: boolean;
  determinism: { state_hash_chain_identical: boolean; observations_byte_identical: boolean };
  keeper_by_team: Record<string, string>;
  verdicts: {
    gk_behavior: Record<string, string>;
    common: Record<string, string>;
    catalog: Record<string, string>;
  };
  save_chains: Array<{
    shotTick: number;
    keeperContactTick: number;
    contactKind: string;
    recordedDistance: number;
    ticksFromShot: number;
    withinReach: boolean;
  }>;
  shots_on_target_faced: number;
  distribution: { releases: number; release_ticks: number[]; release_targets: string[] };
}

interface Record {
  schema_version: number;
  objective_id: string;
  suite_id: string;
  suite_version: string;
  evidence_class: string;
  candidate_commit: string;
  record_sha256: string;
  gameplay_change: string;
  baseline: {
    verdict_counts: Record<string, number>;
    verdicts: Record<string, string>;
    gk_core_owned_record_sha256: string;
  };
  source_change: { src_contracts_diff_empty: boolean };
  driven_streams: DrivenStream[];
  after: {
    gk_behavior: Record<string, { verdict: string }>;
    common: Record<string, string>;
    catalog: Record<string, string>;
  };
  verdict_counts: Record<string, number>;
  delta_vs_baseline_count_change: { changed: boolean; from: Record<string, number>; to: Record<string, number> };
  disclosures: string[];
  claims_not_made: string[];
}

function loadRecord(): Record {
  return readJson<Record>("docs/evidence/GK-DRIVEN-CLOSURE/gk-driven-closure.json");
}

function runReproduce(scenarioPath: string, maxTicks: number) {
  const scenario = loadScenario(scenarioPath);
  const match = runHeadlessMatch({
    scenario,
    maxTicks,
    cpuAntiHuddle: true,
    cpuDefensiveTackle: true,
    gkBehavior: true,
    browserParityObservations: true,
    lifecyclePhaseSync: "core-owned",
  });
  const suite = evaluateSuite("goalkeepers", match.observations);
  const gk: Record<string, string> = {};
  const common: Record<string, string> = {};
  for (const test of suite.tests) {
    for (const c of test.criteria) {
      if (GK_BEHAVIOR.includes(c.criterion_id as (typeof GK_BEHAVIOR)[number])) {
        gk[c.criterion_id] = c.outcome;
      } else if ((COMMON as readonly string[]).includes(c.criterion_id)) {
        common[c.criterion_id] = c.outcome;
      }
    }
  }
  let releases = 0;
  const release_targets: string[] = [];
  for (const o of match.observations) {
    for (const ev of o.events) {
      if (ev.kind !== "keeper-release") continue;
      releases++;
      release_targets.push(
        (ev.payload as { releaseTargetPlayerId?: string } | undefined)?.releaseTargetPlayerId ?? "unknown",
      );
    }
  }
  // Count keeper save/claim contacts (any recorded ball contact / pass by player-10).
  let keeperContacts = 0;
  for (const evt of match.events) {
    const payload = evt.payload as { playerId?: string; planarDistance?: number };
    if (payload.playerId === "player-10" && ["player-ball-contact", "pass"].includes(evt.kind)) {
      keeperContacts++;
    }
  }
  return { gk, common, releases, release_targets, keeperContacts };
}

describe("GK-DRIVEN-CLOSURE goalkeepers-suite record", () => {
  it("durable record exists with the established shape", () => {
    const record = loadRecord();
    expect(record.objective_id).toBe("GK-DRIVEN-CLOSURE");
    expect(record.suite_id).toBe("goalkeepers");
    expect(record.suite_version).toBe("suite-goalkeepers-v1");
    expect(record.evidence_class).toBe("BOOKKEEPING");
    expect(record.schema_version).toBe(1);
    expect(record.gameplay_change).toBe("none");
    expect(record.source_change.src_contracts_diff_empty).toBe(true);
    expect(typeof record.record_sha256).toBe("string");
    expect(record.record_sha256.length).toBeGreaterThan(0);
    expect(record.candidate_commit.length).toBe(40);
    expect(record.driven_streams.length).toBe(2);
    expect(record.disclosures.length).toBeGreaterThan(0);
    expect(record.claims_not_made.length).toBeGreaterThan(0);
  });

  it("baseline is the 9/0/2/1/1 count the horizon binds", () => {
    const record = loadRecord();
    expect(record.baseline.verdict_counts).toEqual({
      PASS: 9,
      FAIL: 0,
      NOT_EVALUATED: 2,
      BLOCKED_MISSING_REFERENCE: 1,
      NEEDS_PERCEPTUAL_REVIEW: 1,
    });
    expect(record.baseline.gk_core_owned_record_sha256).toBe(
      "5cd1c80879d400c2dabfc0ba6d9b195447fc9476f7b6ebb5329877dd2a69204a",
    );
    // No per-criterion aggregate verdict changed.
    expect(record.delta_vs_baseline_count_change.changed).toBe(false);
  });

  it("two driven streams, each deterministic (two-run byte identity)", () => {
    const record = loadRecord();
    for (const stream of record.driven_streams) {
      expect(stream.determinism.state_hash_chain_identical).toBe(true);
      expect(stream.determinism.observations_byte_identical).toBe(true);
      expect(stream.rehome_keeper).toBe(true);
    }
  });

  it("save driven stream: GK-SAVE-CLAIM PASS from a >=1 real save/claim chain", () => {
    const record = loadRecord();
    const save = record.driven_streams.find((s) => s.stream_id === "gk-save-driven");
    expect(save).toBeDefined();
    expect(save!.keeper_by_team["team-b"]).toBe("player-10");
    expect(save!.verdicts.gk_behavior["GK-SAVE-CLAIM"]).toBe("PASS");
    expect(save!.save_chains.length).toBeGreaterThanOrEqual(1);
    for (const chain of save!.save_chains) {
      expect(chain.withinReach).toBe(true);
      expect(chain.keeperContactTick).toBeGreaterThan(chain.shotTick);
      expect(chain.ticksFromShot).toBeLessThanOrEqual(12);
    }
    // The save fixture does not itself drive a distribution release.
    expect(save!.distribution.releases).toBe(0);
    expect(save!.verdicts.gk_behavior["GK-DISTRIBUTION-NO-OMNISCIENCE"]).toBe("NOT_EVALUATED");
  });

  it("release driven stream: GK-DISTRIBUTION-NO-OMNISCIENCE PASS from a >=1 real release", () => {
    const record = loadRecord();
    const release = record.driven_streams.find((s) => s.stream_id === "gk-release-driven");
    expect(release).toBeDefined();
    expect(release!.keeper_by_team["team-b"]).toBe("player-10");
    expect(release!.verdicts.gk_behavior["GK-DISTRIBUTION-NO-OMNISCIENCE"]).toBe("PASS");
    expect(release!.distribution.releases).toBeGreaterThanOrEqual(1);
    // Every release target is an observed team-b teammate (player-9) — no omniscience.
    for (const t of release!.distribution.release_targets) {
      expect(t).toBe("player-9");
    }
    // The release fixture does not answer a shot within the reaction window.
    expect(release!.verdicts.gk_behavior["GK-SAVE-CLAIM"]).toBe("NOT_EVALUATED");
  });

  it("aggregate after state: both criteria PASS, COMMON-DETERMINISTIC PASS, catalog unchanged", () => {
    const record = loadRecord();
    expect(record.after.gk_behavior["GK-SAVE-CLAIM"].verdict).toBe("PASS");
    expect(record.after.gk_behavior["GK-DISTRIBUTION-NO-OMNISCIENCE"].verdict).toBe("PASS");
    expect(record.after.common["COMMON-DETERMINISTIC"]).toBe("PASS");
    expect(record.after.common["COMMON-FINITE"]).toBe("PASS");
    expect(record.after.common["COMMON-REFERENCES"]).toBe("PASS");
    expect(record.after.common["COMMON-BOUNDS"]).toBe("PASS");
    expect(record.after.catalog["ref"]).toBe("BLOCKED_MISSING_REFERENCE");
    expect(record.after.catalog["vis"]).toBe("NEEDS_PERCEPTUAL_REVIEW");
    expect(record.after.catalog["reg"]).toBe("NOT_EVALUATED");
    expect(record.after.catalog["causal"]).toBe("NOT_EVALUATED");
  });

  it("verdict_counts stay 9/0/2/1/1 (blocked + perceptual keys unchanged)", () => {
    const record = loadRecord();
    expect(record.verdict_counts).toEqual({
      PASS: 9,
      FAIL: 0,
      NOT_EVALUATED: 2,
      BLOCKED_MISSING_REFERENCE: 1,
      NEEDS_PERCEPTUAL_REVIEW: 1,
    });
  });

  it("claims_not_made: no PROMOTION / PES fidelity / FOUNDATION_LAB_PASS / suite-level PASS / gameplay change", () => {
    const record = loadRecord();
    const joined = record.claims_not_made.join("\n").toLowerCase();
    expect(joined).toContain("no promotion");
    expect(joined).toContain("no pes");
    expect(joined).toContain("no foundation_lab_pass");
    expect(joined).toContain("no suite-level pass");
    expect(joined).toContain("no gameplay / source / contract change");
    expect(joined).toContain("no accepted record mutation");
  });

  it(
    "record is not hand-written: reproducing the two driven streams yields the pinned verdicts",
    () => {
      const save = runReproduce("eval/scenarios/5v5-keeper-shot-fixture.v1.json", 600);
      expect(save.gk["GK-SAVE-CLAIM"]).toBe("PASS");
      expect(save.gk["GK-DISTRIBUTION-NO-OMNISCIENCE"]).toBe("NOT_EVALUATED");
      expect(save.common["COMMON-BOUNDS"]).toBe("PASS");
      expect(save.keeperContacts).toBeGreaterThanOrEqual(1);

      const release = runReproduce("eval/scenarios/5v5-keeper-release-fixture.v1.json", 300);
      expect(release.gk["GK-DISTRIBUTION-NO-OMNISCIENCE"]).toBe("PASS");
      expect(release.gk["GK-SAVE-CLAIM"]).toBe("NOT_EVALUATED");
      expect(release.releases).toBeGreaterThanOrEqual(1);
      expect(release.release_targets[0]).toBe("player-9");
    },
    180_000,
  );
});
