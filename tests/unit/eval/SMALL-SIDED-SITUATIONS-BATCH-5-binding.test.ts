/**
 * @module tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-5-binding.test.ts
 *
 * Evidence-binding test: proves that the consolidated batch-5 evidence
 * (`docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-5/situations/`) stays
 * byte-identical to its pinned before-state and that fresh evaluator runs on
 * the source fixtures that produced each situation's PASS verdict reproduce the
 * pinned post-fix bytes and the same verdicts.
 *
 * The per-situation pins are two-arm since BALL-SETTLED-REGIME-FIX
 * (`ball-settled-regime-v2`): a settled ball struck by a touch or ground pass
 * now integrates that impulse instead of freezing, which moved the trajectory of
 * every affected fixture. The durable accepted artifacts are immutable and are
 * asserted unchanged; SHOT_TO_RESULT keeps equal accepted/live digests because
 * its fixture never plays a settled ball.
 *
 * BATCH-5 consolidates 8/8 PASS from 3 fixtures:
 * - PASS_RECEPTION, SUPPORT_AND_PASSING_LANES, SETTLED_ATTACK_VS_DEFENCE,
 *   ATTACK_TO_DEFENCE_TRANSITION, DEFENCE_TO_ATTACK_TRANSITION, COORDINATED_PRESS
 *   ← from `3v3-situation-driven-extended.v1.json` (BATCH-4 base)
 * - SHOT_TO_RESULT ← from `3v3-situation-driven-shot-resolution.v1.json`
 * - PHYSICAL_DUEL ← from `3v3-situation-driven-duel-rejection.v1.json`
 *
 * Verifies:
 *  1. All eight situation artifacts and index.json exist in batch-5.
 *  2. Each artifact's verdict is PASS and consistent with index.json.
 *  3. Each artifact's `source_fixture` field matches the expected fixture.
 *  4. Fresh evaluator runs on each source fixture reproduce the pinned
 *     per-situation bytes, the accepted PASS verdict and the accepted relevant
 *     events (determinism + honesty).
 *  5. Consolidated verdict is 8/8 PASS.
 *  6. Index.json metadata reflects consolidated run.
 *  7. Per-situation PASS is attributed to its real source fixture.
 *
 * Node I/O is allowed.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import {
  runSituationEvaluator,
  type SituationEvidenceArtifact,
} from "../../../eval/runners/small-sided-situation-evaluator.js";
import { MAPPED_SITUATION_IDS } from "../../../eval/contracts/situation-mapping.js";
import {
  digestArtifact,
  digestTrajectoryChain,
  type SituationPin,
} from "./situation-run-pin-binding.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_5_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-5/situations",
);

/** All 8 situations covered by batch-5 */
const BATCH_5_TARGETS = [
  "PASS_RECEPTION",
  "SHOT_TO_RESULT",
  "PHYSICAL_DUEL",
  "SUPPORT_AND_PASSING_LANES",
  "SETTLED_ATTACK_VS_DEFENCE",
  "ATTACK_TO_DEFENCE_TRANSITION",
  "DEFENCE_TO_ATTACK_TRANSITION",
  "COORDINATED_PRESS",
];

/**
 * Source fixture mapping per situation: which fixture produces this situation's PASS.
 */
const SOURCE_FIXTURES: Record<string, string> = {
  PASS_RECEPTION: "3v3-situation-driven-extended.v1.json",
  SHOT_TO_RESULT: "3v3-situation-driven-shot-resolution.v1.json",
  PHYSICAL_DUEL: "3v3-situation-driven-duel-rejection.v1.json",
  SUPPORT_AND_PASSING_LANES: "3v3-situation-driven-extended.v1.json",
  SETTLED_ATTACK_VS_DEFENCE: "3v3-situation-driven-extended.v1.json",
  ATTACK_TO_DEFENCE_TRANSITION: "3v3-situation-driven-extended.v1.json",
  DEFENCE_TO_ATTACK_TRANSITION: "3v3-situation-driven-extended.v1.json",
  COORDINATED_PRESS: "3v3-situation-driven-extended.v1.json",
};

/** All situations that share a source fixture — grouped for efficient fresh runs */
const FIXTURE_SITUATION_MAP: Record<string, string[]> = {};
for (const [sitId, fixture] of Object.entries(SOURCE_FIXTURES)) {
  if (!FIXTURE_SITUATION_MAP[fixture]) FIXTURE_SITUATION_MAP[fixture] = [];
  FIXTURE_SITUATION_MAP[fixture].push(sitId);
}

// ---------------------------------------------------------------------------
// Temp dirs for re-run comparison (one per unique source fixture)
// ---------------------------------------------------------------------------

let tmpDirs: Record<string, string> = {};

beforeAll(() => {
  tmpDirs = {};
  for (const fixture of Object.keys(FIXTURE_SITUATION_MAP)) {
    const safeName = fixture.replace(/[^a-z0-9]/g, "-");
    tmpDirs[fixture] = join("/tmp", `batch5-${safeName}-${Date.now()}`);
    mkdirSync(tmpDirs[fixture], { recursive: true });
  }
});

afterAll(() => {
  for (const [, dir] of Object.entries(tmpDirs)) {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

// ---------------------------------------------------------------------------
// 1. Persisted artifacts exist and match index.json
// ---------------------------------------------------------------------------

describe("BATCH-5 binding: persisted artifacts exist", () => {
  it("index.json exists in batch-5 dir", () => {
    expect(existsSync(join(BATCH_5_DIR, "index.json"))).toBe(true);
  });

  it("all eight target situation artifacts exist", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_5_DIR, "index.json"), "utf-8"),
    );
    const sitIds = new Set(
      index.situations.map((s: { situation_id: string }) => s.situation_id),
    );

    for (const target of BATCH_5_TARGETS) {
      expect(
        existsSync(join(BATCH_5_DIR, `${target}.json`)),
        `Missing artifact for ${target}`,
      ).toBe(true);
      expect(sitIds.has(target), `${target} should be in index`).toBe(true);
    }
  });

  it("each target artifact's verdict matches the index", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_5_DIR, "index.json"), "utf-8"),
    );

    for (const target of BATCH_5_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_5_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      const indexEntry = index.situations.find(
        (s: { situation_id: string }) => s.situation_id === target,
      );

      expect(indexEntry).toBeDefined();
      expect(artifact.verdict).toBe(indexEntry!.verdict);
      expect(artifact.relevant_events.length).toBe(indexEntry!.relevant_event_count);
    }
  });

  it("index.json reports 8/8 PASS", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_5_DIR, "index.json"), "utf-8"),
    );

    expect(index.passRate).toBe("8/8");
    expect(index.passCount).toBe(8);
    expect(index.situationCount).toBe(8);
  });

  it("index reflects consolidated fixture count", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_5_DIR, "index.json"), "utf-8"),
    );

    expect(index.sources).toBeDefined();
    expect(index.sources.length).toBe(3);
    const fixtureNames = index.sources.map((s: { fixture: string }) => s.fixture);
    expect(fixtureNames).toContain("3v3-situation-driven-extended.v1.json");
    expect(fixtureNames).toContain("3v3-situation-driven-shot-resolution.v1.json");
    expect(fixtureNames).toContain("3v3-situation-driven-duel-rejection.v1.json");
  });
});

// ---------------------------------------------------------------------------
// 2. Honest verdicts: all 8 PASS
// ---------------------------------------------------------------------------

describe("BATCH-5 binding: honest verdicts", () => {
  it("all eight situations are PASS", () => {
    for (const target of BATCH_5_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_5_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      expect(
        artifact.verdict,
        `Verdict for ${target} should be PASS`,
      ).toBe("PASS");
    }
  });

  it("all artifacts have relevant events (no NOT_EVALUATED)", () => {
    for (const target of BATCH_5_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_5_DIR, `${target}.json`), "utf-8"),
      ) as SituationEvidenceArtifact;

      expect(
        artifact.relevant_events.length,
        `${target} should have relevant events (not NOT_EVALUATED)`,
      ).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. source_fixture provenance fields
// ---------------------------------------------------------------------------

describe("BATCH-5 binding: source_fixture provenance", () => {
  it("each artifact's source_fixture matches expected fixture", () => {
    for (const target of BATCH_5_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_5_DIR, `${target}.json`), "utf-8"),
      ) as Record<string, unknown> & { source_fixture?: string };

      expect(artifact.source_fixture).toBeDefined();
      expect(artifact.source_fixture).toBe(
        SOURCE_FIXTURES[target],
        `${target} should be sourced from ${SOURCE_FIXTURES[target]}`,
      );
    }
  });

  it("index.json source_fixture matches artifact source_fixture", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_5_DIR, "index.json"), "utf-8"),
    );

    for (const entry of index.situations as {
      situation_id: string;
      source_fixture: string;
    }[]) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_5_DIR, `${entry.situation_id}.json`), "utf-8"),
      ) as Record<string, unknown> & { source_fixture?: string };

      expect(artifact.source_fixture).toBe(entry.source_fixture);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Byte-identical re-run per source fixture
// ---------------------------------------------------------------------------

describe("BATCH-5 binding: byte-identical re-run per fixture", () => {
  /**
   * Two-arm pins. `accepted` is the digest of the durable artifact's core
   * content (everything except the `source_fixture` provenance field) — the
   * immutable before-state, asserted never rewritten. `live` is the digest of the
   * run reproduced from the current tree, re-captured after
   * BALL-SETTLED-REGIME-FIX; its prior value equalled the corresponding
   * `accepted` digest — see git history of this file. SHOT_TO_RESULT keeps equal
   * arms: that fixture's ball is never settled when it is played, so the fix
   * leaves its bytes untouched.
   */
  const BATCH_5_SITUATION_PINS: Record<string, SituationPin> = {
    PASS_RECEPTION: {
      accepted: "5a3607c4cb3f52d6412a1ebf9ab88659a670a57622ed56f829d54390b0cd5186",
      live: "e84e82ecc5b0bce786d11c199de08f311ea1169a0ea005d7748d272c9ae7b85f",
    },
    SUPPORT_AND_PASSING_LANES: {
      accepted: "082210cec3115dae1abac55f5f6fadac58354d0b7757cb7ccccf62e96287a2a4",
      live: "e325a36e5f398264c0af22b116e1ab3ba77ce1eb53de141dbd588447b2fc59cd",
    },
    SETTLED_ATTACK_VS_DEFENCE: {
      accepted: "7c34b2bfb0cdcbdbaa5aaa7b9e0d6d7c9079ee40bec4f0bb6abd36588e4138e9",
      live: "0fc3d839440488b4832e6d8b07bc05eb9fd22603c9f2e9e7b3ec068ebf9908d1",
    },
    ATTACK_TO_DEFENCE_TRANSITION: {
      accepted: "7311152cb115bf2df74a347c87b96e9d2853e240d1e4637d06b217aacc4443a2",
      live: "93a9de3483e01cbb9538630c9a58551017226547a1058a06ca7634b59b09e0e6",
    },
    DEFENCE_TO_ATTACK_TRANSITION: {
      accepted: "925173bfe2595fec1822d326822a84d2dc4eb14e353379cb0dcbee9eca52b267",
      live: "0fd03b7f41977248baf47d8a926d09ec0c289461a0b141090d3c28ea5435e7e7",
    },
    COORDINATED_PRESS: {
      accepted: "0dfc70f4f8640356eeeff61dff060ff51320fe6ae65d95379087f48bf7c63ed1",
      live: "69cde80291c95effa48f1ca6c957f9934e445e7a773aa1dd712adb989d019db6",
    },
    SHOT_TO_RESULT: {
      accepted: "e0afe1d2340c151d57daba3797517bfb85c870c47322c60b3be81a4abe5fa0df",
      live: "e0afe1d2340c151d57daba3797517bfb85c870c47322c60b3be81a4abe5fa0df",
    },
    PHYSICAL_DUEL: {
      accepted: "5ef9ba577cbbbe1923997952ef1732a8994a5d7f6e6764375a679d2a37e97c3d",
      live: "2effaec8c3275f05dc509361c987a6857f6e5fd597a8473a80e5b937d87292d6",
    },
  };

  const BATCH_5_TRAJECTORY_PINS: Record<string, SituationPin> = {
    PASS_RECEPTION: {
      accepted: "33948b7eb9d426a90e1a6678f40f2ab6b2a0b395c0b07277acee40f1696ace38",
      live: "cc2dd1b0314df64b655533859a70a46a1de01765adcf32d79652a48bf59876a4",
    },
    SUPPORT_AND_PASSING_LANES: {
      accepted: "33948b7eb9d426a90e1a6678f40f2ab6b2a0b395c0b07277acee40f1696ace38",
      live: "cc2dd1b0314df64b655533859a70a46a1de01765adcf32d79652a48bf59876a4",
    },
    SETTLED_ATTACK_VS_DEFENCE: {
      accepted: "33948b7eb9d426a90e1a6678f40f2ab6b2a0b395c0b07277acee40f1696ace38",
      live: "cc2dd1b0314df64b655533859a70a46a1de01765adcf32d79652a48bf59876a4",
    },
    ATTACK_TO_DEFENCE_TRANSITION: {
      accepted: "33948b7eb9d426a90e1a6678f40f2ab6b2a0b395c0b07277acee40f1696ace38",
      live: "cc2dd1b0314df64b655533859a70a46a1de01765adcf32d79652a48bf59876a4",
    },
    DEFENCE_TO_ATTACK_TRANSITION: {
      accepted: "33948b7eb9d426a90e1a6678f40f2ab6b2a0b395c0b07277acee40f1696ace38",
      live: "cc2dd1b0314df64b655533859a70a46a1de01765adcf32d79652a48bf59876a4",
    },
    COORDINATED_PRESS: {
      accepted: "33948b7eb9d426a90e1a6678f40f2ab6b2a0b395c0b07277acee40f1696ace38",
      live: "cc2dd1b0314df64b655533859a70a46a1de01765adcf32d79652a48bf59876a4",
    },
    SHOT_TO_RESULT: {
      accepted: "da9cafd4dc4355a241c1dc53533c885eac60a5886094a1f2141923dd7e39d4be",
      live: "da9cafd4dc4355a241c1dc53533c885eac60a5886094a1f2141923dd7e39d4be",
    },
    PHYSICAL_DUEL: {
      accepted: "4c0b6970dcfe6c409f19c13f635f2ac9d5444b30b7bf20a47c7e472194f9fa66",
      live: "cb473a45bf73e65667e252490e20549d1bc239e3e5d8512576aa89c104e567db",
    },
  };

  /** Run fresh evaluator on a fixture and check the pinned live artifacts. */
  function compareFixtureRun(fixtureName: string, expectedSits: string[]) {
    const tmpDir = tmpDirs[fixtureName];

    const result = runSituationEvaluator(fixtureName, tmpDir);

    for (const sitId of expectedSits) {
      // Batch-5 artifacts include an extra `source_fixture` field, so the
      // binding compares the artifact's core content.
      const batch5Raw = readFileSync(
        join(BATCH_5_DIR, `${sitId}.json`),
        "utf-8",
      );
      const freshContent = readFileSync(
        join(tmpDir, `${sitId}.json`),
        "utf-8",
      );

      expect(
        digestArtifact(batch5Raw, true),
        `accepted artifact ${sitId} must be unchanged`,
      ).toBe(BATCH_5_SITUATION_PINS[sitId]!.accepted);
      expect(
        digestArtifact(freshContent, true),
        `Artifact ${sitId} from ${fixtureName} must match the pinned live digest`,
      ).toBe(BATCH_5_SITUATION_PINS[sitId]!.live);

      // The accepted honest verdict still reproduces from the live run.
      const acceptedArtifact = JSON.parse(batch5Raw) as SituationEvidenceArtifact;
      const freshArtifact = JSON.parse(freshContent) as SituationEvidenceArtifact;
      expect(freshArtifact.situation_id).toBe(sitId);
      expect(freshArtifact.verdict).toBe("PASS");
      expect(freshArtifact.verdict).toBe(acceptedArtifact.verdict);
      expect(
        freshArtifact.relevant_events.map((event) => event.kind).sort(),
      ).toEqual(acceptedArtifact.relevant_events.map((event) => event.kind).sort());
    }

    // Trajectory hash chains carry the same pins.
    for (const sitId of expectedSits) {
      const acceptedText = readFileSync(join(BATCH_5_DIR, `${sitId}.json`), "utf-8");
      const freshText = readFileSync(join(tmpDir, `${sitId}.json`), "utf-8");
      const acceptedChain = (JSON.parse(acceptedText).trajectory as Array<{ hash: string }>).map(
        (entry) => entry.hash,
      );
      const freshChain = (JSON.parse(freshText).trajectory as Array<{ hash: string }>).map(
        (entry) => entry.hash,
      );

      expect(digestTrajectoryChain(acceptedText)).toBe(
        BATCH_5_TRAJECTORY_PINS[sitId]!.accepted,
      );
      expect(digestTrajectoryChain(freshText)).toBe(BATCH_5_TRAJECTORY_PINS[sitId]!.live);
      expect(freshChain.length).toBe(acceptedChain.length);
      expect(freshChain.length).toBeGreaterThan(0);
    }
  }

  it("extended fixture produces the pinned artifacts for its 6 situations", () => {
    const extendedSits = FIXTURE_SITUATION_MAP["3v3-situation-driven-extended.v1.json"]!;
    compareFixtureRun("3v3-situation-driven-extended.v1.json", extendedSits);
  });

  it("shot-resolution fixture produces byte-identical artifact for SHOT_TO_RESULT", () => {
    const shotSits = FIXTURE_SITUATION_MAP["3v3-situation-driven-shot-resolution.v1.json"]!;
    compareFixtureRun("3v3-situation-driven-shot-resolution.v1.json", shotSits);
    // Unmoved by the fix: its accepted and live digests are equal.
    expect(BATCH_5_SITUATION_PINS["SHOT_TO_RESULT"]!.accepted).toBe(
      BATCH_5_SITUATION_PINS["SHOT_TO_RESULT"]!.live,
    );
  });

  it("duel-rejection fixture produces the pinned artifact for PHYSICAL_DUEL", () => {
    const duelSits = FIXTURE_SITUATION_MAP["3v3-situation-driven-duel-rejection.v1.json"]!;
    compareFixtureRun("3v3-situation-driven-duel-rejection.v1.json", duelSits);
  });

  it("two fresh runs of each source fixture are byte-identical to each other", () => {
    for (const [fixtureName, sits] of Object.entries(FIXTURE_SITUATION_MAP)) {
      runSituationEvaluator(fixtureName, tmpDirs[fixtureName]!);
      const first = sits.map((sit) =>
        digestArtifact(readFileSync(join(tmpDirs[fixtureName]!, `${sit}.json`), "utf-8"), true),
      );
      runSituationEvaluator(fixtureName, tmpDirs[fixtureName]!);
      const second = sits.map((sit) =>
        digestArtifact(readFileSync(join(tmpDirs[fixtureName]!, `${sit}.json`), "utf-8"), true),
      );
      expect(second).toEqual(first);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Consolidated verdict is 8/8 PASS
// ---------------------------------------------------------------------------

describe("BATCH-5 binding: consolidated verdict", () => {
  it("index reports 8 PASS situations", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_5_DIR, "index.json"), "utf-8"),
    );

    const passCount = index.situations.filter(
      (s: { verdict: string }) => s.verdict === "PASS",
    ).length;
    expect(passCount).toBe(8);
  });

  it("each PASS situation is attributed to its real source fixture", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_5_DIR, "index.json"), "utf-8"),
    );

    for (const entry of index.situations as {
      situation_id: string;
      verdict: string;
      source_fixture: string;
    }[]) {
      expect(entry.verdict).toBe("PASS");
      expect(entry.source_fixture).toBe(
        SOURCE_FIXTURES[entry.situation_id],
        `${entry.situation_id} should be attributed to ${SOURCE_FIXTURES[entry.situation_id]}`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 6. index.json metadata correctness
// ---------------------------------------------------------------------------

describe("BATCH-5 binding: index metadata", () => {
  it("index reflects consolidated run metadata", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_5_DIR, "index.json"), "utf-8"),
    );

    expect(index.objective_id).toBe("SMALL-SIDED-SITUATIONS-BATCH-5");
    expect(index.totalTicks).toBe(60);
    expect(index.seed).toBe(42);
    expect(typeof index.finalStateHash).toBe("string");
    expect(index.finalStateHash).toMatch(/^fnv1a64-v1:/);
  });

  it("all 8 mapped situations appear in index", () => {
    const index = JSON.parse(
      readFileSync(join(BATCH_5_DIR, "index.json"), "utf-8"),
    );

    const indexSitIds = new Set(
      index.situations.map((s: { situation_id: string }) => s.situation_id),
    );
    for (const id of MAPPED_SITUATION_IDS) {
      expect(indexSitIds.has(id), `Missing situation ${id} in index`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Artifact shape validation
// ---------------------------------------------------------------------------

describe("BATCH-5 binding: artifact shape", () => {
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
      "source_fixture",
    ];

    for (const target of BATCH_5_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_5_DIR, `${target}.json`), "utf-8"),
      ) as Record<string, unknown>;

      for (const field of requiredFields) {
        expect(artifact[field], `${field} missing from ${target}`).toBeDefined();
      }
    }
  });

  it("trajectory entries have tick, hash, players, ball fields", () => {
    for (const target of BATCH_5_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_5_DIR, `${target}.json`), "utf-8"),
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
    for (const target of BATCH_5_TARGETS) {
      const artifact = JSON.parse(
        readFileSync(join(BATCH_5_DIR, `${target}.json`), "utf-8"),
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
});