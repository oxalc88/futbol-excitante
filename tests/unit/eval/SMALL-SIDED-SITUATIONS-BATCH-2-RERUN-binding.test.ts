/**
 * @module tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN-binding.test.ts
 *
 * Evidence-binding test: proves that the persisted batch-2-rerun evidence
 * (`docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN/situations/`) matches
 * a fresh evaluator run (live honesty) against the TRANSITION driven fixture.
 *
 * Verifies:
 *  1. All four target situation artifacts exist in batch-2-rerun.
 *  2. Each artifact's verdict and relevant_event_count match the index.
 *  3. A fresh run to a temp directory produces byte-identical artifacts.
 *  4. Honest verdicts match expectations:
 *     - NOT_EVALUATED: SETTLED_ATTACK_VS_DEFENCE (required kinds absent).
 *     - FAIL: the other 3 (required present, indicative absent).
 *  5. Verdict rationale is correct per the mapping rules.
 *
 * Node I/O is allowed.
 */

import { readFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
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

const BATCH_2_RERUN_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN/situations",
);

/** The four situations covered by this batch */
const BATCH_2_RERUN_TARGETS = [
  "SETTLED_ATTACK_VS_DEFENCE",
  "ATTACK_TO_DEFENCE_TRANSITION",
  "DEFENCE_TO_ATTACK_TRANSITION",
  "COORDINATED_PRESS",
];

/** Expected verdicts for the transition-driven fixture (3v3-transition-driven.v1.json) */
const EXPECTED_VERDICTS: Record<string, "PASS" | "FAIL" | "NOT_EVALUATED"> = {
  SETTLED_ATTACK_VS_DEFENCE: "NOT_EVALUATED",
  ATTACK_TO_DEFENCE_TRANSITION: "FAIL",
  DEFENCE_TO_ATTACK_TRANSITION: "FAIL",
  COORDINATED_PRESS: "FAIL",
};

// ---------------------------------------------------------------------------
// Temp dir for re-run comparison
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeAll(() => {
  tmpDir = join("/tmp", `batch2-rerun-binding-${Date.now()}`);
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

describe("BATCH-2-RERUN binding: persisted artifacts exist", () => {
  it("index.json exists in batch-2-rerun dir", () => {
    const indexPath = join(BATCH_2_RERUN_DIR, "index.json");
    expect(existsSync(indexPath)).toBe(true);
  });

  it("all four target situation artifacts exist", () => {
    const indexPath = join(BATCH_2_RERUN_DIR, "index.json");
    expect(existsSync(indexPath)).toBe(true);
    const index = JSON.parse(readFileSync(indexPath, "utf-8"));
    const sitIds = new Set(index.situations.map((s: { situation_id: string }) => s.situation_id));

    for (const target of BATCH_2_RERUN_TARGETS) {
      expect(
        existsSync(join(BATCH_2_RERUN_DIR, `${target}.json`)),
        `Missing artifact for ${target}`,
      ).toBe(true);
      expect(sitIds.has(target), `${target} should be in index`).toBe(true);
    }
  });

  it("each target artifact's verdict matches the index", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_2_RERUN_DIR, "index.json"), "utf-8"),
    );

    for (const target of BATCH_2_RERUN_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_2_RERUN_DIR, `${target}.json`), "utf-8"),
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
    for (const target of BATCH_2_RERUN_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_2_RERUN_DIR, `${target}.json`), "utf-8"),
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

describe("BATCH-2-RERUN binding: honest verdicts", () => {
  it("expected verdicts are correct (PASS/FAIL/NOT_EVALUATED per oracle)", () => {
    for (const target of BATCH_2_RERUN_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_2_RERUN_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      const expected = EXPECTED_VERDICTS[target];
      expect(
        artifact.verdict,
        `Verdict for ${target} should be ${expected}`,
      ).toBe(expected);
    }
  });

  it("all target situations have relevant events (the run produces events)", () => {
    for (const target of BATCH_2_RERUN_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_2_RERUN_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      expect(
        artifact.relevant_events.length,
        `${target} should have relevant events (even if verdict is NOT_EVALUATED due to wrong kinds)`,
      ).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Byte-identical re-run
// ---------------------------------------------------------------------------

describe("BATCH-2-RERUN binding: byte-identical re-run", () => {
  it("a fresh run to temp dir produces byte-identical artifacts", () => {
    const result = runSituationEvaluator(
      "3v3-transition-driven.v1.json",
      tmpDir,
    );

    for (const target of BATCH_2_RERUN_TARGETS) {
      const rerunContent = readFileSync(
        join(BATCH_2_RERUN_DIR, `${target}.json`),
        "utf-8",
      );
      const freshContent = readFileSync(
        join(tmpDir, `${target}.json`),
        "utf-8",
      );

      expect(freshContent).toBe(rerunContent,
        `Artifact ${target} from fresh run must match batch-2-rerun persisted artifact`,
      );

      const artifact = result.situationArtifacts.find((a) => a.situation_id === target);
      expect(artifact).toBeDefined();
      expect(artifact!.verdict).toBe(EXPECTED_VERDICTS[target]);
    }
  });

  it("re-run produces identical index.json", () => {
    const rerunIndex = readFileSync(
      join(BATCH_2_RERUN_DIR, "index.json"),
      "utf-8",
    );

    runSituationEvaluator("3v3-transition-driven.v1.json", tmpDir);

    const freshIndex = readFileSync(
      join(tmpDir, "index.json"),
      "utf-8",
    );

    expect(freshIndex).toBe(rerunIndex);
  });

  it("re-run produces identical trajectory hashes", () => {
    runSituationEvaluator("3v3-transition-driven.v1.json", tmpDir);

    for (const target of BATCH_2_RERUN_TARGETS) {
      const rerunArtifact = JSON.parse(
        readFileSync(join(BATCH_2_RERUN_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;
      const freshArtifact = JSON.parse(
        readFileSync(join(tmpDir, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      expect(freshArtifact.trajectory.map((t) => t.hash)).toEqual(
        rerunArtifact.trajectory.map((t) => t.hash),
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Verdict computation is consistent
// ---------------------------------------------------------------------------

describe("BATCH-2-RERUN binding: verdict computation", () => {
  it("verdict_reason is descriptive for each target", () => {
    for (const target of BATCH_2_RERUN_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_2_RERUN_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      expect(artifact.verdict_reason).toContain(target);
    }
  });

  it("FAIL situations mention indicative kinds in verdict_reason", () => {
    for (const target of BATCH_2_RERUN_TARGETS) {
      if (EXPECTED_VERDICTS[target] === "FAIL") {
        const artifact = JSON.parse(
          readFileSync(join(BATCH_2_RERUN_DIR, `${target}.json`), "utf-8"),
        ) as SituationEvidenceArtifact;

        const req = SITUATION_EVIDENCE_REQUIREMENTS[target];
        if (req!.indicative_event_kinds.length > 0) {
          expect(artifact.verdict_reason).toContain(req!.indicative_event_kinds[0]);
        }
      }
    }
  });

  it("NOT_EVALUATED situation does NOT have indicative kinds in verdict_reason", () => {
    const artifact = JSON.parse(
      readFileSync(join(BATCH_2_RERUN_DIR, "SETTLED_ATTACK_VS_DEFENCE.json"), "utf-8"),
    ) as SituationEvidenceArtifact;

    expect(artifact.verdict_reason).toContain("SETTLED_ATTACK_VS_DEFENCE");
    // The reason should say "None of required event kinds ... appeared"
    expect(artifact.verdict_reason).toContain("None of required event kinds");
  });
});

// ---------------------------------------------------------------------------
// 5. index.json metadata correctness
// ---------------------------------------------------------------------------

describe("BATCH-2-RERUN binding: index metadata", () => {
  it("index reflects transition-driven fixture metadata", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_2_RERUN_DIR, "index.json"), "utf-8"),
    );

    expect(index.fixtureName).toBe("3v3-transition-driven.v1.json");
    expect(index.scenarioId).toBe("3v3-transition-driven-v1");
    expect(index.totalTicks).toBe(60);
    expect(index.seed).toBe(42);
    expect(typeof index.finalStateHash).toBe("string");
    expect(index.finalStateHash).toMatch(/^fnv1a64-v1:/);
    expect(index.situationCount).toBe(8);
  });

  it("all 8 mapped situations appear in index", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_2_RERUN_DIR, "index.json"), "utf-8"),
    );

    const indexSitIds = new Set(index.situations.map((s: { situation_id: string }) => s.situation_id));
    for (const id of MAPPED_SITUATION_IDS) {
      expect(indexSitIds.has(id), `Missing situation ${id} in index`).toBe(true);
    }
  });

  it("total_ticks and seed match the transition-driven fixture", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_2_RERUN_DIR, "index.json"), "utf-8"),
    );

    expect(index.totalTicks).toBe(60);
    expect(index.seed).toBe(42);
  });

  it("index reports hasInvariantFailures", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_2_RERUN_DIR, "index.json"), "utf-8"),
    );

    expect(index.hasInvariantFailures).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Verdict expectations: why each situation gets its verdict
// ---------------------------------------------------------------------------

describe("BATCH-2-RERUN binding: verdict rationale", () => {
  it("SETTLED_ATTACK_VS_DEFENCE: NOT_EVALUATED — required kinds absent (pass, player-ball-contact, player-player-contact); only indicative 'shot' present", () => {
    const artifact = JSON.parse(
      readFileSync(join(BATCH_2_RERUN_DIR, "SETTLED_ATTACK_VS_DEFENCE.json"), "utf-8"),
    ) as SituationEvidenceArtifact;

    expect(artifact.verdict).toBe("NOT_EVALUATED");
    const eventKinds = new Set(artifact.relevant_events.map((e) => e.kind));
    // Only shot appears; required kinds are absent.
    expect(eventKinds.has("shot")).toBe(true);
    expect(eventKinds.has("pass")).toBe(false);
    expect(eventKinds.has("player-ball-contact")).toBe(false);
    expect(eventKinds.has("player-player-contact")).toBe(false);
  });

  it("ATTACK_TO_DEFENCE_TRANSITION: FAIL — required 'shot' present, indicative 'player-player-contact' absent", () => {
    const artifact = JSON.parse(
      readFileSync(join(BATCH_2_RERUN_DIR, "ATTACK_TO_DEFENCE_TRANSITION.json"), "utf-8"),
    ) as SituationEvidenceArtifact;

    expect(artifact.verdict).toBe("FAIL");
    const eventKinds = new Set(artifact.relevant_events.map((e) => e.kind));
    expect(eventKinds.has("shot")).toBe(true);
    expect(eventKinds.has("player-player-contact")).toBe(false);
    expect(eventKinds.has("player-ball-contact")).toBe(false);
  });

  it("DEFENCE_TO_ATTACK_TRANSITION: FAIL — required 'shot' present, indicative 'player-player-contact' absent", () => {
    const artifact = JSON.parse(
      readFileSync(join(BATCH_2_RERUN_DIR, "DEFENCE_TO_ATTACK_TRANSITION.json"), "utf-8"),
    ) as SituationEvidenceArtifact;

    expect(artifact.verdict).toBe("FAIL");
    const eventKinds = new Set(artifact.relevant_events.map((e) => e.kind));
    expect(eventKinds.has("shot")).toBe(true);
    expect(eventKinds.has("player-player-contact")).toBe(false);
    expect(eventKinds.has("ball-out-of-play")).toBe(false);
  });

  it("COORDINATED_PRESS: FAIL — required 'shot' present, indicative 'player-ball-contact' absent", () => {
    const artifact = JSON.parse(
      readFileSync(join(BATCH_2_RERUN_DIR, "COORDINATED_PRESS.json"), "utf-8"),
    ) as SituationEvidenceArtifact;

    expect(artifact.verdict).toBe("FAIL");
    const eventKinds = new Set(artifact.relevant_events.map((e) => e.kind));
    expect(eventKinds.has("shot")).toBe(true);
    expect(eventKinds.has("player-ball-contact")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. NOT_EVALUATED guard: required kinds absent → NOT_EVALUATED
// ---------------------------------------------------------------------------

describe("BATCH-2-RERUN binding: NOT_EVALUATED guard", () => {
  it("SETTLED_ATTACK_VS_DEFENCE: has relevant events but NOT_EVALUATED because required kinds absent", () => {
    const artifact = JSON.parse(
      readFileSync(join(BATCH_2_RERUN_DIR, "SETTLED_ATTACK_VS_DEFENCE.json"), "utf-8"),
    ) as SituationEvidenceArtifact;

    expect(artifact.relevant_events.length).toBeGreaterThan(0);
    expect(artifact.verdict).toBe("NOT_EVALUATED");
  });

  it("computeSituationVerdict returns NOT_EVALUATED when required kinds are absent despite events present", () => {
    const req = SITUATION_EVIDENCE_REQUIREMENTS["SETTLED_ATTACK_VS_DEFENCE"];
    expect(req).toBeDefined();

    // Events present but only indicative kind, no required kinds → NOT_EVALUATED.
    const eventsWithOnlyIndicative = [
      { id: "e1", tick: 10, sequence: 0, kind: "shot", label: "shot", payload: {} },
    ];
    const { verdict } = computeSituationVerdict(
      "SETTLED_ATTACK_VS_DEFENCE",
      eventsWithOnlyIndicative as any,
      req!,
    );
    expect(verdict).toBe("NOT_EVALUATED");
  });
});

// ---------------------------------------------------------------------------
// 8. Artifact shape validation
// ---------------------------------------------------------------------------

describe("BATCH-2-RERUN binding: artifact shape", () => {
  it("all artifacts have required top-level fields", () => {
    const requiredFields = [
      "situation_id", "evidence_requirement", "verdict", "verdict_reason",
      "relevant_events", "relevant_observations", "team_geometry",
      "all_events", "all_observations", "trajectory",
      "has_invariant_failures", "total_ticks", "scenario_id",
    ];

    for (const target of BATCH_2_RERUN_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_2_RERUN_DIR, `${target}.json`), "utf-8"),
      ) as Record<string, unknown>;

      for (const field of requiredFields) {
        expect(artifact[field], `${field} missing from ${target}`).toBeDefined();
      }
    }
  });

  it("trajectory entries have tick, hash, players, ball fields", () => {
    for (const target of BATCH_2_RERUN_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_2_RERUN_DIR, `${target}.json`), "utf-8"),
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
    for (const target of BATCH_2_RERUN_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_2_RERUN_DIR, `${target}.json`), "utf-8"),
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
    for (const target of BATCH_2_RERUN_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_2_RERUN_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      expect(artifact.all_events.length).toBeGreaterThan(0);
    }
  });
});