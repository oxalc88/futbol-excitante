/**
 * @module tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-4-binding.test.ts
 *
 * Evidence-binding test: proves that the persisted batch-4 evidence
 * (`docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-4/situations/`) matches
 * a fresh evaluator run (live honesty) against the EXTENDED situation-driven
 * fixture (`3v3-situation-driven-extended.v1.json`).
 *
 * This batch is post-EVALUATOR-ISRELEVANT-FIX: `isRelevantEvent` now includes
 * `indicative_event_kinds` for every situation, so `second-touch` events are
 * now relevant for `PASS_RECEPTION` and `SUPPORT_AND_PASSING_LANES`.
 *
 * Verifies:
 *  1. All eight situation artifacts exist in batch-4.
 *  2. Each artifact's verdict and relevant_event_count match the index.
 *  3. A fresh run to a temp directory produces byte-identical artifacts.
 *  4. Honest verdicts match expectations:
 *     - PASS_RECEPTION: PASS (required + indicative second-touch present)
 *     - SHOT_TO_RESULT: FAIL (shot present, pitch-contact absent)
 *     - PHYSICAL_DUEL: FAIL (player-player-contact present, input-rejection absent)
 *     - SUPPORT_AND_PASSING_LANES: PASS (required + indicative second-touch present)
 *     - SETTLED_ATTACK_VS_DEFENCE: PASS (all required + indicative shot)
 *     - ATTACK_TO_DEFENCE_TRANSITION: PASS (required + indicative present)
 *     - DEFENCE_TO_ATTACK_TRANSITION: PASS (required + indicative present)
 *     - COORDINATED_PRESS: PASS (required + indicative present)
 *  5. Extended fixture produces second-touch events that appear in
 *     relevant_events for PASS_RECEPTION and SUPPORT_AND_PASSING_LANES
 *     (isRelevantEvent now includes indicative_event_kinds).
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

const BATCH_4_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-4/situations",
);

/** All 8 situations covered by the extended fixture */
const BATCH_4_TARGETS = [
  "PASS_RECEPTION",
  "SHOT_TO_RESULT",
  "PHYSICAL_DUEL",
  "SUPPORT_AND_PASSING_LANES",
  "SETTLED_ATTACK_VS_DEFENCE",
  "ATTACK_TO_DEFENCE_TRANSITION",
  "DEFENCE_TO_ATTACK_TRANSITION",
  "COORDINATED_PRESS",
];

/** Expected verdicts for the extended situation-driven fixture (post-fix) */
const EXPECTED_VERDICTS: Record<string, "PASS" | "FAIL" | "NOT_EVALUATED"> = {
  PASS_RECEPTION: "PASS",
  SHOT_TO_RESULT: "FAIL",
  PHYSICAL_DUEL: "FAIL",
  SUPPORT_AND_PASSING_LANES: "PASS",
  SETTLED_ATTACK_VS_DEFENCE: "PASS",
  ATTACK_TO_DEFENCE_TRANSITION: "PASS",
  DEFENCE_TO_ATTACK_TRANSITION: "PASS",
  COORDINATED_PRESS: "PASS",
};

// ---------------------------------------------------------------------------
// Temp dir for re-run comparison
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeAll(() => {
  tmpDir = join("/tmp", `batch4-binding-${Date.now()}`);
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

describe("BATCH-4 binding: persisted artifacts exist", () => {
  it("index.json exists in batch-4 dir", () => {
    const indexPath = join(BATCH_4_DIR, "index.json");
    expect(existsSync(indexPath)).toBe(true);
  });

  it("all eight target situation artifacts exist", () => {
    const indexPath = join(BATCH_4_DIR, "index.json");
    expect(existsSync(indexPath)).toBe(true);
    const index = JSON.parse(readFileSync(indexPath, "utf-8"));
    const sitIds = new Set(
      index.situations.map((s: { situation_id: string }) => s.situation_id),
    );

    for (const target of BATCH_4_TARGETS) {
      expect(
        existsSync(join(BATCH_4_DIR, `${target}.json`)),
        `Missing artifact for ${target}`,
      ).toBe(true);
      expect(sitIds.has(target), `${target} should be in index`).toBe(true);
    }
  });

  it("each target artifact's verdict matches the index", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_4_DIR, "index.json"), "utf-8"),
    );

    for (const target of BATCH_4_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_4_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      const indexEntry = index.situations.find(
        (s: { situation_id: string }) => s.situation_id === target,
      );

      expect(indexEntry).toBeDefined();
      expect(artifact.verdict).toBe(indexEntry!.verdict);
      expect(artifact.relevant_events.length).toBe(indexEntry!.relevant_event_count);
    }
  });

  it("target artifacts have correct mapping references", () => {
    for (const target of BATCH_4_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_4_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      const req = SITUATION_EVIDENCE_REQUIREMENTS[target];
      expect(req).toBeDefined();
      expect(artifact.evidence_requirement.situation_id).toBe(target);
      expect(artifact.evidence_requirement.required_event_kinds).toEqual(
        req!.required_event_kinds,
      );
      expect(artifact.evidence_requirement.indicative_event_kinds).toEqual(
        req!.indicative_event_kinds,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Honest verdicts match expectations
// ---------------------------------------------------------------------------

describe("BATCH-4 binding: honest verdicts", () => {
  it("expected verdicts are correct (PASS/FAIL per oracle)", () => {
    for (const target of BATCH_4_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_4_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      const expected = EXPECTED_VERDICTS[target];
      expect(
        artifact.verdict,
        `Verdict for ${target} should be ${expected}`,
      ).toBe(expected);
    }
  });

  it("SETTLED_ATTACK_VS_DEFENCE: PASS — all required + indicative shot present", () => {
    const artifact = JSON.parse(
      readFileSync(join(BATCH_4_DIR, "SETTLED_ATTACK_VS_DEFENCE.json"), "utf-8"),
    ) as SituationEvidenceArtifact;

    expect(artifact.verdict).toBe("PASS");
    const eventKinds = new Set(artifact.relevant_events.map((e) => e.kind));
    expect(eventKinds.has("pass")).toBe(true);
    expect(eventKinds.has("player-ball-contact")).toBe(true);
    expect(eventKinds.has("player-player-contact")).toBe(true);
    expect(eventKinds.has("shot")).toBe(true); // indicative
  });

  it("all FAIL situations have relevant events (events exist, indicative missing)", () => {
    for (const target of BATCH_4_TARGETS) {
      if (EXPECTED_VERDICTS[target] === "FAIL") {
        const artifact = JSON.parse(
          readFileSync(join(BATCH_4_DIR, `${target}.json`), "utf-8"),
        ) as SituationEvidenceArtifact;

        expect(
          artifact.relevant_events.length,
          `${target} should have relevant events`,
        ).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Byte-identical re-run
// ---------------------------------------------------------------------------

describe("BATCH-4 binding: byte-identical re-run", () => {
  it("a fresh run to temp dir produces byte-identical artifacts", () => {
    const result = runSituationEvaluator(
      "3v3-situation-driven-extended.v1.json",
      tmpDir,
    );

    for (const target of BATCH_4_TARGETS) {
      const batch4Content = readFileSync(
        join(BATCH_4_DIR, `${target}.json`),
        "utf-8",
      );
      const freshContent = readFileSync(
        join(tmpDir, `${target}.json`),
        "utf-8",
      );

      expect(freshContent).toBe(
        batch4Content,
        `Artifact ${target} from fresh run must match batch-4 persisted artifact`,
      );

      const artifact = result.situationArtifacts.find(
        (a) => a.situation_id === target,
      );
      expect(artifact).toBeDefined();
      expect(artifact!.verdict).toBe(EXPECTED_VERDICTS[target]);
    }
  });

  it("re-run produces identical index.json", () => {
    const batch4Index = readFileSync(
      join(BATCH_4_DIR, "index.json"),
      "utf-8",
    );

    runSituationEvaluator("3v3-situation-driven-extended.v1.json", tmpDir);

    const freshIndex = readFileSync(
      join(tmpDir, "index.json"),
      "utf-8",
    );

    expect(freshIndex).toBe(batch4Index);
  });

  it("re-run produces identical trajectory hashes", () => {
    runSituationEvaluator("3v3-situation-driven-extended.v1.json", tmpDir);

    for (const target of BATCH_4_TARGETS) {
      const batch4Artifact = JSON.parse(
        readFileSync(join(BATCH_4_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;
      const freshArtifact = JSON.parse(
        readFileSync(join(tmpDir, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      expect(freshArtifact.trajectory.map((t) => t.hash)).toEqual(
        batch4Artifact.trajectory.map((t) => t.hash),
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Verdict computation is consistent
// ---------------------------------------------------------------------------

describe("BATCH-4 binding: verdict computation", () => {
  it("verdict_reason is descriptive for each target", () => {
    for (const target of BATCH_4_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_4_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      expect(artifact.verdict_reason).toContain(target);
    }
  });

  it("PASS situation mentions indicative kinds in verdict_reason", () => {
    const artifact = JSON.parse(
      readFileSync(join(BATCH_4_DIR, "SETTLED_ATTACK_VS_DEFENCE.json"), "utf-8"),
    ) as SituationEvidenceArtifact;

    const req = SITUATION_EVIDENCE_REQUIREMENTS["SETTLED_ATTACK_VS_DEFENCE"];
    if (req!.indicative_event_kinds.length > 0) {
      expect(artifact.verdict_reason).toContain(req!.indicative_event_kinds[0]);
    }
  });

  it("FAIL situations mention indicative kinds in verdict_reason", () => {
    for (const target of BATCH_4_TARGETS) {
      if (EXPECTED_VERDICTS[target] === "FAIL") {
        const artifact = JSON.parse(
          readFileSync(join(BATCH_4_DIR, `${target}.json`), "utf-8"),
        ) as SituationEvidenceArtifact;

        const req = SITUATION_EVIDENCE_REQUIREMENTS[target];
        if (req!.indicative_event_kinds.length > 0) {
          expect(artifact.verdict_reason).toContain(req!.indicative_event_kinds[0]);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. index.json metadata correctness
// ---------------------------------------------------------------------------

describe("BATCH-4 binding: index metadata", () => {
  it("index reflects extended fixture metadata", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_4_DIR, "index.json"), "utf-8"),
    );

    expect(index.fixtureName).toBe("3v3-situation-driven-extended.v1.json");
    expect(index.scenarioId).toBe("3v3-situation-driven-extended-v1");
    expect(index.totalTicks).toBe(60);
    expect(index.seed).toBe(42);
    expect(typeof index.finalStateHash).toBe("string");
    expect(index.finalStateHash).toMatch(/^fnv1a64-v1:/);
    expect(index.situationCount).toBe(8);
  });

  it("all 8 mapped situations appear in index", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_4_DIR, "index.json"), "utf-8"),
    );

    const indexSitIds = new Set(
      index.situations.map((s: { situation_id: string }) => s.situation_id),
    );
    for (const id of MAPPED_SITUATION_IDS) {
      expect(indexSitIds.has(id), `Missing situation ${id} in index`).toBe(true);
    }
  });

  it("index reports hasInvariantFailures", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_4_DIR, "index.json"), "utf-8"),
    );

    expect(index.hasInvariantFailures).toBe(true);
  });

  it("total_ticks and seed match the extended fixture", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_4_DIR, "index.json"), "utf-8"),
    );

    expect(index.totalTicks).toBe(60);
    expect(index.seed).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// 6. Extended fixture produces second-touch events (all_events + relevant)
// ---------------------------------------------------------------------------

describe("BATCH-4 binding: extended fixture event kinds", () => {
  it("PASS_RECEPTION: all_events and relevant_events both include second-touch", () => {
    const artifact = JSON.parse(
      readFileSync(join(BATCH_4_DIR, "PASS_RECEPTION.json"), "utf-8"),
    ) as SituationEvidenceArtifact;

    const allKinds = new Set(artifact.all_events.map((e) => e.kind));
    expect(allKinds.has("second-touch")).toBe(true);

    const relevantKinds = new Set(artifact.relevant_events.map((e) => e.kind));
    expect(relevantKinds.has("second-touch")).toBe(true);
  });

  it("SUPPORT_AND_PASSING_LANES: all_events and relevant_events both include second-touch", () => {
    const artifact = JSON.parse(
      readFileSync(join(BATCH_4_DIR, "SUPPORT_AND_PASSING_LANES.json"), "utf-8"),
    ) as SituationEvidenceArtifact;

    const allKinds = new Set(artifact.all_events.map((e) => e.kind));
    expect(allKinds.has("second-touch")).toBe(true);

    const relevantKinds = new Set(artifact.relevant_events.map((e) => e.kind));
    expect(relevantKinds.has("second-touch")).toBe(true);
  });

  it("PASS_RECEPTION: relevant events have pass, player-ball-contact, second-touch", () => {
    const artifact = JSON.parse(
      readFileSync(join(BATCH_4_DIR, "PASS_RECEPTION.json"), "utf-8"),
    ) as SituationEvidenceArtifact;

    expect(artifact.verdict).toBe("PASS");
    const eventKinds = new Set(artifact.relevant_events.map((e) => e.kind));
    expect(eventKinds.has("pass")).toBe(true);
    expect(eventKinds.has("player-ball-contact")).toBe(true);
    expect(eventKinds.has("second-touch")).toBe(true);
  });

  it("DEFENCE_TO_ATTACK_TRANSITION: relevant events include indicative kinds present", () => {
    const artifact = JSON.parse(
      readFileSync(join(BATCH_4_DIR, "DEFENCE_TO_ATTACK_TRANSITION.json"), "utf-8"),
    ) as SituationEvidenceArtifact;

    expect(artifact.verdict).toBe("PASS");
    const eventKinds = new Set(artifact.relevant_events.map((e) => e.kind));
    expect(eventKinds.has("player-ball-contact")).toBe(true);
    expect(eventKinds.has("shot")).toBe(true);
    expect(eventKinds.has("player-player-contact")).toBe(true);
    // ball-out-of-play is indicative but not present in this fixture
    expect(eventKinds.has("ball-out-of-play")).toBe(false);
  });

  it("COORDINATED_PRESS: required present and indicative player-ball-contact included in relevant", () => {
    const artifact = JSON.parse(
      readFileSync(join(BATCH_4_DIR, "COORDINATED_PRESS.json"), "utf-8"),
    ) as SituationEvidenceArtifact;

    expect(artifact.verdict).toBe("PASS");
    const eventKinds = new Set(artifact.relevant_events.map((e) => e.kind));
    // Required kinds: player-player-contact, input-rejection, pass, shot
    expect(eventKinds.has("player-player-contact")).toBe(true);
    expect(eventKinds.has("pass")).toBe(true);
    expect(eventKinds.has("shot")).toBe(true);
    // input-rejection is a REQUIRED kind but not present in this fixture
    expect(eventKinds.has("input-rejection")).toBe(false);
    // Indicative: player-ball-contact — now included in relevant via isRelevantEvent fix
    expect(eventKinds.has("player-ball-contact")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Artifact shape validation
// ---------------------------------------------------------------------------

describe("BATCH-4 binding: artifact shape", () => {
  it("all artifacts have required top-level fields", () => {
    const requiredFields = [
      "situation_id",
      "evidence_requirement",
      "verdict",
      "verdict_reason",
      "relevant_events",
      "relevant_observations",
      "team_geometry",
      "all_events",
      "all_observations",
      "trajectory",
      "has_invariant_failures",
      "total_ticks",
      "scenario_id",
    ];

    for (const target of BATCH_4_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_4_DIR, `${target}.json`), "utf-8"),
      ) as Record<string, unknown>;

      for (const field of requiredFields) {
        expect(artifact[field], `${field} missing from ${target}`).toBeDefined();
      }
    }
  });

  it("trajectory entries have tick, hash, players, ball fields", () => {
    for (const target of BATCH_4_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_4_DIR, `${target}.json`), "utf-8"),
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
    for (const target of BATCH_4_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_4_DIR, `${target}.json`), "utf-8"),
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
    for (const target of BATCH_4_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_4_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      expect(artifact.all_events.length).toBeGreaterThan(0);
    }
  });
});