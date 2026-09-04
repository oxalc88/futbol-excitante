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
 *  3. The durable accepted artifacts stay byte-identical to their pinned before-state,
 *     and a fresh run to a temp directory reproduces the pinned post-fix bytes
 *     (re-captured after BALL-SETTLED-REGIME-FIX; see SITUATION_PINS below).
 *  4. Honest verdicts match expectations:
 *     - PASS_RECEPTION: PASS (required + indicative second-touch present)
 *     - SHOT_TO_RESULT: FAIL (shot present, but indicative pitch-contact absent in driven fixture)
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
import {
  digestArtifact,
  digestTrajectoryChain,
  type SituationPin,
} from "./situation-run-pin-binding.js";

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

/**
 * Two-arm pins for this binding — identical accepted artifacts to batch-3, same
 * extended fixture.
 *
 * `accepted` is the digest of the durable artifact under docs/evidence, asserted
 * unchanged: accepted evidence is immutable and stays the before-state. `live` is
 * the digest of the run reproduced from the current tree, re-captured after
 * BALL-SETTLED-REGIME-FIX; its prior value equalled the corresponding `accepted`
 * digest — see git history of this file.
 *
 * The fix lets a settled ball integrate the impulse a touch or ground pass
 * applies (before it, the ball carried the impulse and never moved), which moves
 * every per-tick trajectory hash of this fixture from tick 1 on. The accepted
 * verdict, relevant event kinds and event counts are still asserted to reproduce
 * from the live run, so the binding keeps proving gameplay, not just bytes.
 */
const BATCH_4_SITUATION_PINS: Record<string, SituationPin> = {
  PASS_RECEPTION: {
    accepted: "1d1b7d3775880040ca42be40065a12255a718451d2d9812ce376c129acf75507",
    live: "880007590ca8578db03712d9f4f33de0ce39e0ea9740d2a5d706de34e95186ca",
  },
  SHOT_TO_RESULT: {
    accepted: "ba816b9ece333bc6b13486d65501d6363a71b2d52334d4519398d353404133db",
    live: "8483cbf5a79a871da303102c6a1d72fe12831de27b1920b4c77a9288fff527bd",
  },
  PHYSICAL_DUEL: {
    accepted: "3ded5062d1dce66c49e7fe97719d20737bc5bd04d7806397b6e664faf93b6543",
    live: "c448b0e6b4d66ee2ae75a5c668bac3f1adc8286f1323f6490b42867805abc3c1",
  },
  SUPPORT_AND_PASSING_LANES: {
    accepted: "dc270bbe976773c291711053061c68c30dec05860595c2b92e21f9c0026603cc",
    live: "f5c1dc2af0785e30404d8f278117bd1917103bdb3eae96fd9b70e6676574e10c",
  },
  SETTLED_ATTACK_VS_DEFENCE: {
    accepted: "4573ae6ea8604f43aa3e1c2df6ed4b5aaf33ec86e04903dda5568177795e07e7",
    live: "0f73176c4c3d054d82f9f21afbb36bbe3d46fb6ccda250a66ab5c5f6e1df0014",
  },
  ATTACK_TO_DEFENCE_TRANSITION: {
    accepted: "ee374ea9d4e192688a981d0afb91da1869889d807bfda41f5d304b1e6b399d36",
    live: "14d37ffc265964cd77a9d9a990d621466192ed4f7707f42488a8da042f48ca20",
  },
  DEFENCE_TO_ATTACK_TRANSITION: {
    accepted: "35d7bf8ff5bf7f2ebea8a474507b47d65b2fbc566ce08c4b690fbf0abdb2eb05",
    live: "2dfdfb2868c845a9f05e9f04143d9aa6ee1da726dcb4764b89e71bbcb9bd111f",
  },
  COORDINATED_PRESS: {
    accepted: "6dd2cdbbeaff059dec641b68f7d1c490823e640903f451ac9783244e754b5fb6",
    live: "b3b595a0e589ea28ba037f86ae1d318f6aa226c45874275317da9340ec96dc57",
  },
};

/** One shared trajectory chain per artifact: the fixture runs one match. */
const BATCH_4_TRAJECTORY_PINS: Record<string, SituationPin> = Object.fromEntries(
  Object.keys(BATCH_4_SITUATION_PINS).map((target) => [
    target,
    {
      accepted: "33948b7eb9d426a90e1a6678f40f2ab6b2a0b395c0b07277acee40f1696ace38",
      live: "cc2dd1b0314df64b655533859a70a46a1de01765adcf32d79652a48bf59876a4",
    },
  ]),
);

const BATCH_4_INDEX_PIN: SituationPin = {
  accepted: "25e28d52c552113764505c9c974716865912e199b5fb135d983095bac03fa32e",
  live: "1c2732bf5f8688d43c291bd7753207d59ff07c27a84141dad443b3cf7eb5be2e",
};

describe("BATCH-4 binding: byte-identical re-run", () => {
  it("the durable accepted artifacts are byte-identical to their pinned before-state", () => {
    for (const target of BATCH_4_TARGETS) {
      const acceptedContent = readFileSync(
        join(BATCH_4_DIR, `${target}.json`),
        "utf-8",
      );
      expect(
        digestArtifact(acceptedContent),
        `accepted artifact ${target} must be unchanged`,
      ).toBe(BATCH_4_SITUATION_PINS[target]!.accepted);
    }
    expect(
      digestArtifact(readFileSync(join(BATCH_4_DIR, "index.json"), "utf-8")),
    ).toBe(BATCH_4_INDEX_PIN.accepted);
  });

  it("a fresh run to temp dir reproduces the pinned post-fix artifacts and verdicts", () => {
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

      expect(
        digestArtifact(freshContent),
        `Artifact ${target} from fresh run must match the pinned live digest`,
      ).toBe(BATCH_4_SITUATION_PINS[target]!.live);

      const acceptedArtifact = JSON.parse(batch4Content) as SituationEvidenceArtifact;
      const freshArtifact = JSON.parse(freshContent) as SituationEvidenceArtifact;
      expect(freshArtifact.verdict).toBe(acceptedArtifact.verdict);
      expect(
        freshArtifact.relevant_events.map((event) => event.kind).sort(),
      ).toEqual(acceptedArtifact.relevant_events.map((event) => event.kind).sort());

      const artifact = result.situationArtifacts.find(
        (a) => a.situation_id === target,
      );
      expect(artifact).toBeDefined();
      expect(artifact!.verdict).toBe(EXPECTED_VERDICTS[target]);
    }
  });

  it("re-run produces the pinned index.json and matches the accepted verdicts", () => {
    const batch4Index = readFileSync(join(BATCH_4_DIR, "index.json"), "utf-8");

    runSituationEvaluator("3v3-situation-driven-extended.v1.json", tmpDir);

    const freshIndex = readFileSync(join(tmpDir, "index.json"), "utf-8");

    expect(digestArtifact(batch4Index)).toBe(BATCH_4_INDEX_PIN.accepted);
    expect(digestArtifact(freshIndex)).toBe(BATCH_4_INDEX_PIN.live);

    const acceptedEntries = JSON.parse(batch4Index).situations as Array<{
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
    runSituationEvaluator("3v3-situation-driven-extended.v1.json", tmpDir);

    for (const target of BATCH_4_TARGETS) {
      const acceptedText = readFileSync(join(BATCH_4_DIR, `${target}.json`), "utf-8");
      const freshText = readFileSync(join(tmpDir, `${target}.json`), "utf-8");
      const acceptedChain = (JSON.parse(acceptedText).trajectory as Array<{ hash: string }>).map(
        (entry) => entry.hash,
      );
      const freshChain = (JSON.parse(freshText).trajectory as Array<{ hash: string }>).map(
        (entry) => entry.hash,
      );

      expect(digestTrajectoryChain(acceptedText)).toBe(
        BATCH_4_TRAJECTORY_PINS[target]!.accepted,
      );
      expect(digestTrajectoryChain(freshText)).toBe(BATCH_4_TRAJECTORY_PINS[target]!.live);
      expect(freshChain.length).toBe(acceptedChain.length);
      expect(freshChain.length).toBeGreaterThan(0);
    }
  });

  it("two fresh runs are byte-identical to each other", () => {
    runSituationEvaluator("3v3-situation-driven-extended.v1.json", tmpDir);
    const first = BATCH_4_TARGETS.map((target) =>
      digestArtifact(readFileSync(join(tmpDir, `${target}.json`), "utf-8")),
    );

    runSituationEvaluator("3v3-situation-driven-extended.v1.json", tmpDir);
    const second = BATCH_4_TARGETS.map((target) =>
      digestArtifact(readFileSync(join(tmpDir, `${target}.json`), "utf-8")),
    );

    expect(second).toEqual(first);
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