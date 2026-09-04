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
 *  3. The durable accepted artifacts stay byte-identical to their pinned before-state,
 *     and a fresh run to a temp directory reproduces the pinned post-fix bytes
 *     (re-captured after BALL-SETTLED-REGIME-FIX; see SITUATION_PINS below).
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
import {
  digestArtifact,
  digestTrajectoryChain,
  type SituationPin,
} from "./situation-run-pin-binding.js";

/**
 * Two-arm pins for this binding.
 *
 * `accepted` is the digest of the durable artifact under docs/evidence — the
 * immutable before-state, asserted here to prove the settled-regime fix never
 * rewrote it. `live` is the digest of the run reproduced from the current tree,
 * re-captured after BALL-SETTLED-REGIME-FIX; its prior value equalled the
 * corresponding `accepted` digest — see git history of this file.
 *
 * The fix lets a settled ball integrate the impulse a touch or ground pass
 * applies (before it, the ball carried the impulse and never moved), so every
 * per-tick trajectory hash of this fixture moves from tick 1 on. The accepted
 * verdict, relevant event kinds and relevant event counts are still asserted to
 * reproduce from the live run, so the binding keeps proving gameplay.
 */
const BATCH_1_RERUN_SITUATION_PINS: Record<string, SituationPin> = {
  PASS_RECEPTION: {
    accepted: "088a7c9cec1fb0c4b2f3959d13bccc81c47bc70abc941cd50eb33ea7d0b64459",
    live: "4c46b2b876c456f08500ea22f841906f46becd5028d45b3b0b0777102055c02f",
  },
  SHOT_TO_RESULT: {
    accepted: "07e793c605ca7596499dc280e6a7e6cbe99e7d0b5376cd9574f3797217999b7c",
    live: "e44ecfaaefc2d1c5e922c7e8e89675ecf2510d03d250e6789133692eeb31733a",
  },
  PHYSICAL_DUEL: {
    accepted: "fda30beb842f93acefdb95d43bc03e836da838fddd2605c7739e47fc389a74e5",
    live: "5b17359c34549514bbe03d18dc567d2326cd3e9c5749ee6c83772757fc6a4b16",
  },
  SUPPORT_AND_PASSING_LANES: {
    accepted: "ca87c6b864a7ff0f1531870fd91e00251fc961461b32096754578c02646a1180",
    live: "ca189034d545ffad7bbd49c30bdb45adf4936f50ef3f6e80038be2d19692abea",
  },
  SETTLED_ATTACK_VS_DEFENCE: {
    accepted: "01698e2a1a4da435caed9d45329ea5c684a0660ceae9b4f13322a1cfe02ca697",
    live: "0a377786be1e0ac53bd7f051b54babb807ee8292fc4b5e3b7f7604dc9e895b4c",
  },
};

/** One shared trajectory chain per artifact: the fixture runs one match. */
const BATCH_1_RERUN_TRAJECTORY_PINS: Record<string, SituationPin> = Object.fromEntries(
  Object.keys(BATCH_1_RERUN_SITUATION_PINS).map((target) => [
    target,
    {
      accepted: "d2805ac848ffeafd28c71b5983aa8b122fe88f64c60e7259f50c6245c90ecc06",
      live: "ff0d09fb923b1057fc133be34e49dbe623eb16c6ad404d6120178b21c91efef9",
    },
  ]),
);

const BATCH_1_RERUN_INDEX_PIN: SituationPin = {
  accepted: "a1479da4bc7760ef74ea15ad4b50c29bc7ececb6c8038e6949ed1ba9585efdf3",
  live: "e0bae47f8bbcca99d48bdeb16e6c635fd5fdaa23a8638effcef2424d3e7cd1b8",
};

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
  it("the durable accepted artifacts are byte-identical to their pinned before-state", () => {
    for (const target of [...BATCH_1_RERUN_TARGETS, "SETTLED_ATTACK_VS_DEFENCE"]) {
      const acceptedContent = readFileSync(
        join(BATCH_1_RERUN_DIR, `${target}.json`),
        "utf-8",
      );
      expect(
        digestArtifact(acceptedContent),
        `accepted artifact ${target} must be unchanged`,
      ).toBe(BATCH_1_RERUN_SITUATION_PINS[target]!.accepted);
    }
    expect(
      digestArtifact(readFileSync(join(BATCH_1_RERUN_DIR, "index.json"), "utf-8")),
    ).toBe(BATCH_1_RERUN_INDEX_PIN.accepted);
  });

  it("a fresh run to temp dir reproduces the pinned post-fix artifacts and verdicts", () => {
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

      expect(
        digestArtifact(freshContent),
        `Artifact ${target} from fresh run must match the pinned live digest`,
      ).toBe(BATCH_1_RERUN_SITUATION_PINS[target]!.live);

      // The accepted honest verdict and its relevant events still reproduce.
      const acceptedArtifact = JSON.parse(rerunContent) as SituationEvidenceArtifact;
      const freshArtifact = JSON.parse(freshContent) as SituationEvidenceArtifact;
      expect(freshArtifact.verdict).toBe(acceptedArtifact.verdict);
      expect(
        freshArtifact.relevant_events.map((event) => event.kind).sort(),
      ).toEqual(acceptedArtifact.relevant_events.map((event) => event.kind).sort());

      // Also verify verdict in fresh result.
      const artifact = result.situationArtifacts.find((a) => a.situation_id === target);
      expect(artifact).toBeDefined();
      expect(artifact!.verdict).toBe(EXPECTED_VERDICTS[target]);
    }

    // Also compare SETTLED_ATTACK_VS_DEFENCE.
    const settlementFreshContent = readFileSync(
      join(tmpDir, "SETTLED_ATTACK_VS_DEFENCE.json"),
      "utf-8",
    );
    expect(digestArtifact(settlementFreshContent)).toBe(
      BATCH_1_RERUN_SITUATION_PINS["SETTLED_ATTACK_VS_DEFENCE"]!.live,
    );
  });

  it("re-run produces the pinned index.json and matches the accepted verdicts", () => {
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

    expect(digestArtifact(rerunIndex)).toBe(BATCH_1_RERUN_INDEX_PIN.accepted);
    expect(digestArtifact(freshIndex)).toBe(BATCH_1_RERUN_INDEX_PIN.live);

    const acceptedEntries = JSON.parse(rerunIndex).situations as Array<{
      situation_id: string;
      verdict: string;
      relevant_event_count: number;
    }>;
    const freshEntries = JSON.parse(freshIndex).situations as Array<{
      situation_id: string;
      verdict: string;
      relevant_event_count: number;
    }>;
    expect(freshEntries.map((entry) => [entry.situation_id, entry.verdict])).toEqual(
      acceptedEntries.map((entry) => [entry.situation_id, entry.verdict]),
    );
    expect(freshEntries.map((entry) => entry.relevant_event_count)).toEqual(
      acceptedEntries.map((entry) => entry.relevant_event_count),
    );
  });

  it("re-run produces the pinned trajectory hash chain over the same tick count", () => {
    runSituationEvaluator("3v3-situation-driven.v1.json", tmpDir);

    for (const target of BATCH_1_RERUN_TARGETS) {
      const acceptedText = readFileSync(join(BATCH_1_RERUN_DIR, `${target}.json`), "utf-8");
      const freshText = readFileSync(join(tmpDir, `${target}.json`), "utf-8");
      const acceptedChain = (JSON.parse(acceptedText).trajectory as Array<{ hash: string }>).map(
        (entry) => entry.hash,
      );
      const freshChain = (JSON.parse(freshText).trajectory as Array<{ hash: string }>).map(
        (entry) => entry.hash,
      );

      expect(digestTrajectoryChain(acceptedText)).toBe(
        BATCH_1_RERUN_TRAJECTORY_PINS[target]!.accepted,
      );
      expect(digestTrajectoryChain(freshText)).toBe(
        BATCH_1_RERUN_TRAJECTORY_PINS[target]!.live,
      );
      expect(freshChain.length).toBe(acceptedChain.length);
      expect(freshChain.length).toBeGreaterThan(0);
    }
  });

  it("two fresh runs are byte-identical to each other", () => {
    runSituationEvaluator("3v3-situation-driven.v1.json", tmpDir);
    const first = BATCH_1_RERUN_TARGETS.map((target) =>
      digestArtifact(readFileSync(join(tmpDir, `${target}.json`), "utf-8")),
    );

    runSituationEvaluator("3v3-situation-driven.v1.json", tmpDir);
    const second = BATCH_1_RERUN_TARGETS.map((target) =>
      digestArtifact(readFileSync(join(tmpDir, `${target}.json`), "utf-8")),
    );

    expect(second).toEqual(first);
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