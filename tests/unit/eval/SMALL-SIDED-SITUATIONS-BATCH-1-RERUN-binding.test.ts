/**
 * @module tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-1-RERUN-binding.test.ts
 *
 * Evidence-binding test: proves that the persisted batch-1-rerun evidence
 * (`docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-1-RERUN/situations/`) matches
 * a fresh evaluator run (live honesty) against the DRIVEN fixture.
 *
 * Verifies:
 *  1. All four target situation artifacts exist in batch-1-rerun.
 *  2. Each artifact's verdict and relevant_event_count match the index.
 *  3. A fresh run to a temp directory produces byte-identical artifacts.
 *  4. Honest verdicts match expectations:
 *     - PASS: SETTLED_ATTACK_VS_DEFENCE (required + indicative present).
 *     - FAIL: the other 3 (required present, indicative absent).
 *     - NOT_EVALUATED: never for this driven fixture (events are present).
 *
 * Node I/O is allowed.
 */

import { readFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import {
  runSituationEvaluator,
  computeSituationVerdict,
  type SituationEvidenceArtifact,
} from "../../../eval/runners/small-sided-situation-evaluator.js";
import {
  MAPPED_SITUATION_IDS,
  SITUATION_EVIDENCE_REQUIREMENTS,
} from "../../../eval/contracts/situation-mapping.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_1_RERUN_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-1-RERUN/situations",
);

/** The four situations covered by this batch */
const BATCH_1_RERUN_TARGETS = [
  "PASS_RECEPTION",
  "SHOT_TO_RESULT",
  "PHYSICAL_DUEL",
  "SUPPORT_AND_PASSING_LANES",
];

/** Expected verdicts for the driven fixture (3v3-situation-driven.v1.json) */
const EXPECTED_VERDICTS: Record<string, "PASS" | "FAIL" | "NOT_EVALUATED"> = {
  PASS_RECEPTION: "FAIL",
  SHOT_TO_RESULT: "FAIL",
  PHYSICAL_DUEL: "FAIL",
  SUPPORT_AND_PASSING_LANES: "FAIL",
};

/** Expected verdict for the 5th situation (not a BATCH-1 target, but present) */
const EXPECTED_VERDICT_5TH = "PASS"; // SETTLED_ATTACK_VS_DEFENCE

// ---------------------------------------------------------------------------
// Temp dir for re-run comparison
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeAll(() => {
  tmpDir = join("/tmp", `batch1-rerun-binding-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterAll(() => {
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 1. Persisted artifacts exist and match the index
// ---------------------------------------------------------------------------

describe("BATCH-1-RERUN binding: persisted artifacts exist", () => {
  it("index.json exists in batch-1-rerun dir", () => {
    const indexPath = join(BATCH_1_RERUN_DIR, "index.json");
    expect(existsSync(indexPath)).toBe(true);
  });

  it("all four target situation artifacts exist", () => {
    const indexPath = join(BATCH_1_RERUN_DIR, "index.json");
    expect(existsSync(indexPath)).toBe(true);
    const index = JSON.parse(readFileSync(indexPath, "utf-8"));
    const sitIds = new Set(index.situations.map((s: { situation_id: string }) => s.situation_id));

    for (const target of BATCH_1_RERUN_TARGETS) {
      expect(
        existsSync(join(BATCH_1_RERUN_DIR, `${target}.json`)),
        `Missing artifact for ${target}`,
      ).toBe(true);
      expect(sitIds.has(target), `${target} should be in index`).toBe(true);
    }
  });

  it("each target artifact's verdict matches the index", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_1_RERUN_DIR, "index.json"), "utf-8"),
    );

    for (const target of BATCH_1_RERUN_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_1_RERUN_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      const indexEntry = index.situations.find(
        (s: { situation_id: string }) => s.situation_id === target,
      );

      expect(indexEntry).toBeDefined();
      expect(artifact.verdict).toBe(indexEntry.verdict);
      expect(artifact.relevant_events.length).toBe(indexEntry.relevant_event_count);
    }
  });

  it("target artifacts have correct mapping references", () => {
    for (const target of BATCH_1_RERUN_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_1_RERUN_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      const req = SITUATION_EVIDENCE_REQUIREMENTS[target];
      expect(req).toBeDefined();
      expect(artifact.evidence_requirement.situation_id).toBe(target);
      expect(artifact.evidence_requirement.required_event_kinds).toEqual(req!.required_event_kinds);
      expect(artifact.evidence_requirement.indicative_event_kinds).toEqual(req!.indicative_event_kinds);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Honest verdicts match expectations
// ---------------------------------------------------------------------------

describe("BATCH-1-RERUN binding: honest verdicts", () => {
  it("expected verdicts are correct (PASS/FAIL per oracle)", () => {
    for (const target of BATCH_1_RERUN_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_1_RERUN_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      const expected = EXPECTED_VERDICTS[target];
      expect(
        artifact.verdict,
        `Verdict for ${target} should be ${expected}`,
      ).toBe(expected);
    }

    // Also check SETTLED_ATTACK_VS_DEFENCE (not a BATCH-1 target but in the fixture).
    const settlementArtifact = JSON.parse(
      readFileSync(join(BATCH_1_RERUN_DIR, "SETTLED_ATTACK_VS_DEFENCE.json"), "utf-8"),
    ) as SituationEvidenceArtifact;
    expect(settlementArtifact.verdict).toBe(EXPECTED_VERDICT_5TH);
  });

  it("target situations have non-zero relevant events (driven fixture produces events)", () => {
    for (const target of BATCH_1_RERUN_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_1_RERUN_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      expect(
        artifact.relevant_events.length,
        `${target} should have relevant events`,
      ).toBeGreaterThan(0);
    }
  });

  it("SETTLED_ATTACK_VS_DEFENCE has non-zero relevant events", () => {
    const artifact = JSON.parse(
      readFileSync(join(BATCH_1_RERUN_DIR, "SETTLED_ATTACK_VS_DEFENCE.json"), "utf-8"),
    ) as SituationEvidenceArtifact;

    expect(artifact.relevant_events.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Byte-identical re-run
// ---------------------------------------------------------------------------

describe("BATCH-1-RERUN binding: byte-identical re-run", () => {
  it("a fresh run to temp dir produces byte-identical artifacts", () => {
    // Run the evaluator to a temp dir.
    const result = runSituationEvaluator(
      "3v3-situation-driven.v1.json",
      tmpDir,
    );

    // Compare each target situation artifact against batch-1-rerun.
    for (const target of BATCH_1_RERUN_TARGETS) {
      const rerunContent = readFileSync(
        join(BATCH_1_RERUN_DIR, `${target}.json`),
        "utf-8",
      );
      const freshContent = readFileSync(
        join(tmpDir, `${target}.json`),
        "utf-8",
      );

      expect(freshContent).toBe(rerunContent,
        `Artifact ${target} from fresh run must match batch-1-rerun persisted artifact`,
      );

      // Also verify verdict in fresh result.
      const artifact = result.situationArtifacts.find((a) => a.situation_id === target);
      expect(artifact).toBeDefined();
      expect(artifact!.verdict).toBe(EXPECTED_VERDICTS[target]);
    }

    // Also compare SETTLED_ATTACK_VS_DEFENCE.
    const settlementRerunContent = readFileSync(
      join(BATCH_1_RERUN_DIR, "SETTLED_ATTACK_VS_DEFENCE.json"),
      "utf-8",
    );
    const settlementFreshContent = readFileSync(
      join(tmpDir, "SETTLED_ATTACK_VS_DEFENCE.json"),
      "utf-8",
    );
    expect(settlementFreshContent).toBe(settlementRerunContent,
      "SETTLED_ATTACK_VS_DEFENCE from fresh run must match batch-1-rerun",
    );
  });

  it("re-run produces identical index.json", () => {
    const rerunIndex = readFileSync(
      join(BATCH_1_RERUN_DIR, "index.json"),
      "utf-8",
    );

    // Run again to same temp dir (overwrites).
    runSituationEvaluator("3v3-situation-driven.v1.json", tmpDir);

    const freshIndex = readFileSync(
      join(tmpDir, "index.json"),
      "utf-8",
    );

    expect(freshIndex).toBe(rerunIndex);
  });

  it("re-run produces identical trajectory hashes", () => {
    runSituationEvaluator("3v3-situation-driven.v1.json", tmpDir);

    for (const target of BATCH_1_RERUN_TARGETS) {
      const rerunArtifact = JSON.parse(
        readFileSync(join(BATCH_1_RERUN_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;
      const freshArtifact = JSON.parse(
        readFileSync(join(tmpDir, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      // Trajectory entries should have identical hashes.
      expect(freshArtifact.trajectory.map((t) => t.hash)).toEqual(
        rerunArtifact.trajectory.map((t) => t.hash),
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Verdict computation is consistent
// ---------------------------------------------------------------------------

describe("BATCH-1-RERUN binding: verdict computation", () => {
  it("verdict_reason is descriptive", () => {
    for (const target of BATCH_1_RERUN_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_1_RERUN_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      expect(artifact.verdict_reason).toContain(target);
    }
  });

  it("verdict_reason for FAIL situations mentions indicative kinds", () => {
    for (const target of BATCH_1_RERUN_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_1_RERUN_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      const req = SITUATION_EVIDENCE_REQUIREMENTS[target];
      if (req!.indicative_event_kinds.length > 0) {
        expect(artifact.verdict_reason).toContain(req!.indicative_event_kinds[0]);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. index.json metadata correctness
// ---------------------------------------------------------------------------

describe("BATCH-1-RERUN binding: index metadata", () => {
  it("index reflects driven fixture metadata", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_1_RERUN_DIR, "index.json"), "utf-8"),
    );

    expect(index.fixtureName).toBe("3v3-situation-driven.v1.json");
    expect(index.scenarioId).toBe("3v3-situation-driven-v1");
    expect(index.totalTicks).toBe(60);
    expect(index.seed).toBe(42);
    expect(typeof index.finalStateHash).toBe("string");
    expect(index.finalStateHash).toMatch(/^fnv1a64-v1:/);
    expect(index.situationCount).toBe(8);
  });

  it("all 8 mapped situations appear in index", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_1_RERUN_DIR, "index.json"), "utf-8"),
    );

    const indexSitIds = new Set(index.situations.map((s: { situation_id: string }) => s.situation_id));
    for (const id of MAPPED_SITUATION_IDS) {
      expect(indexSitIds.has(id), `Missing situation ${id} in index`).toBe(true);
    }
  });

  it("total_ticks and seed match the driven fixture", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_1_RERUN_DIR, "index.json"), "utf-8"),
    );

    expect(index.totalTicks).toBe(60);
    expect(index.seed).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// 6. Verdict expectations: why each situation gets its verdict
// ---------------------------------------------------------------------------

describe("BATCH-1-RERUN binding: verdict rationale", () => {
  it("PASS_RECEPTION: FAIL — required present (pass, player-ball-contact), indicative absent (second-touch)", () => {
    const artifact = JSON.parse(
      readFileSync(join(BATCH_1_RERUN_DIR, "PASS_RECEPTION.json"), "utf-8"),
    ) as SituationEvidenceArtifact;

    expect(artifact.verdict).toBe("FAIL");
    const eventKinds = new Set(artifact.relevant_events.map((e) => e.kind));
    expect(eventKinds.has("pass")).toBe(true);
    expect(eventKinds.has("player-ball-contact")).toBe(true);
    expect(eventKinds.has("second-touch")).toBe(false);
  });

  it("SHOT_TO_RESULT: FAIL — required 'shot' present, but indicative 'pitch-contact' absent in driven fixture (horizontal shots on ground)", () => {
    const artifact = JSON.parse(
      readFileSync(join(BATCH_1_RERUN_DIR, "SHOT_TO_RESULT.json"), "utf-8"),
    ) as SituationEvidenceArtifact;

    expect(artifact.verdict).toBe("FAIL");
    const eventKinds = new Set(artifact.relevant_events.map((e) => e.kind));
    expect(eventKinds.has("shot")).toBe(true);
    expect(eventKinds.has("pitch-contact")).toBe(false);
  });

  it("PHYSICAL_DUEL: FAIL — required 'player-player-contact' present, indicative 'input-rejection' absent", () => {
    const artifact = JSON.parse(
      readFileSync(join(BATCH_1_RERUN_DIR, "PHYSICAL_DUEL.json"), "utf-8"),
    ) as SituationEvidenceArtifact;

    expect(artifact.verdict).toBe("FAIL");
    const eventKinds = new Set(artifact.relevant_events.map((e) => e.kind));
    expect(eventKinds.has("player-player-contact")).toBe(true);
    expect(eventKinds.has("input-rejection")).toBe(false);
  });

  it("SUPPORT_AND_PASSING_LANES: FAIL — required present, indicative 'second-touch' absent", () => {
    const artifact = JSON.parse(
      readFileSync(join(BATCH_1_RERUN_DIR, "SUPPORT_AND_PASSING_LANES.json"), "utf-8"),
    ) as SituationEvidenceArtifact;

    expect(artifact.verdict).toBe("FAIL");
    const eventKinds = new Set(artifact.relevant_events.map((e) => e.kind));
    expect(eventKinds.has("pass")).toBe(true);
    expect(eventKinds.has("player-ball-contact")).toBe(true);
    expect(eventKinds.has("second-touch")).toBe(false);
  });

  it("SETTLED_ATTACK_VS_DEFENCE: PASS — required (pass, player-ball-contact, player-player-contact) + indicative (shot) present", () => {
    const artifact = JSON.parse(
      readFileSync(join(BATCH_1_RERUN_DIR, "SETTLED_ATTACK_VS_DEFENCE.json"), "utf-8"),
    ) as SituationEvidenceArtifact;

    expect(artifact.verdict).toBe("PASS");
    const eventKinds = new Set(artifact.relevant_events.map((e) => e.kind));
    expect(eventKinds.has("pass")).toBe(true);
    expect(eventKinds.has("player-ball-contact")).toBe(true);
    expect(eventKinds.has("player-player-contact")).toBe(true);
    expect(eventKinds.has("shot")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. NOT_EVALUATED guard: no events → NOT_EVALUATED (sanity)
// ---------------------------------------------------------------------------

describe("BATCH-1-RERUN binding: NOT_EVALUATED guard", () => {
  it("computeSituationVerdict returns NOT_EVALUATED for empty events", () => {
    for (const target of BATCH_1_RERUN_TARGETS) {
      const req = SITUATION_EVIDENCE_REQUIREMENTS[target];
      expect(req).toBeDefined();
      const { verdict, reason } = computeSituationVerdict(target, [], req!);
      expect(verdict).toBe("NOT_EVALUATED");
      expect(reason).toContain("No relevant events");
    }
  });

  it("PASS_RECEPTION verdict computation with representative events", () => {
    const req = SITUATION_EVIDENCE_REQUIREMENTS["PASS_RECEPTION"];
    expect(req).toBeDefined();

    // Without indicative → FAIL.
    const eventsWithoutIndicative = [
      { id: "e1", tick: 10, sequence: 0, kind: "pass", label: "pass", payload: {} },
      { id: "e2", tick: 11, sequence: 0, kind: "player-ball-contact", label: "touch", payload: {} },
    ];
    const { verdict: v1 } = computeSituationVerdict("PASS_RECEPTION", eventsWithoutIndicative as any, req!);
    expect(v1).toBe("FAIL");

    // With indicative → PASS.
    const eventsWithIndicative = [
      ...eventsWithoutIndicative,
      { id: "e3", tick: 12, sequence: 0, kind: "second-touch", label: "second", payload: {} },
    ];
    const { verdict: v2 } = computeSituationVerdict("PASS_RECEPTION", eventsWithIndicative as any, req!);
    expect(v2).toBe("PASS");
  });
});

// ---------------------------------------------------------------------------
// 8. Artifact shape validation
// ---------------------------------------------------------------------------

describe("BATCH-1-RERUN binding: artifact shape", () => {
  it("all artifacts have required top-level fields", () => {
    const requiredFields = [
      "situation_id", "evidence_requirement", "verdict", "verdict_reason",
      "relevant_events", "relevant_observations", "team_geometry",
      "all_events", "all_observations", "trajectory",
      "has_invariant_failures", "total_ticks", "scenario_id",
    ];

    for (const target of BATCH_1_RERUN_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_1_RERUN_DIR, `${target}.json`), "utf-8"),
      ) as Record<string, unknown>;

      for (const field of requiredFields) {
        expect(artifact[field], `${field} missing from ${target}`).toBeDefined();
      }
    }
  });

  it("trajectory entries have tick, hash, players, ball fields", () => {
    for (const target of BATCH_1_RERUN_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_1_RERUN_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      expect(artifact.trajectory.length).toBeGreaterThan(0);
      const firstEntry = artifact.trajectory[0];
      expect(typeof firstEntry.tick).toBe("number");
      expect(typeof firstEntry.hash).toBe("string");
      expect(Array.isArray(firstEntry.players)).toBe(true);
      expect(firstEntry.players.length).toBe(6);
      expect(typeof firstEntry.ball.position.x).toBe("number");
      expect(typeof firstEntry.ball.position.y).toBe("number");
      expect(typeof firstEntry.ball.position.z).toBe("number");
      expect(typeof firstEntry.ball.regime).toBe("string");
    }
  });

  it("team_geometry entries have player positions", () => {
    for (const target of BATCH_1_RERUN_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_1_RERUN_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      expect(artifact.team_geometry.length).toBe(artifact.total_ticks);
      const firstGeom = artifact.team_geometry[0];
      expect(firstGeom.players.length).toBe(6);
      for (const p of firstGeom.players) {
        expect(typeof p.playerId).toBe("string");
        expect(typeof p.teamId).toBe("string");
        expect(typeof p.position.x).toBe("number");
        expect(typeof p.position.y).toBe("number");
      }
    }
  });

  it("all_events covers the full run", () => {
    for (const target of BATCH_1_RERUN_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_1_RERUN_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      // all_events should contain every event from every tick.
      // With 60 ticks and events from the driven fixture, expect at least a few.
      expect(artifact.all_events.length).toBeGreaterThan(0);
    }
  });
});