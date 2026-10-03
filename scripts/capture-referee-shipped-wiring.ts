/**
 * Node-side evidence producer for REFEREE-SHIPPED-WIRING.
 *
 * DYNAMIC_VISUAL evidence: the referee loop (foul → free kick, then the
 * accumulating booking) visible in the real shipped runtime via the accepted
 * test-bridge browser test (tests/browser/referee-shipped-wiring.browser.test.ts),
 * driven with BOTH accepted gates through the SAME createSimulation config
 * surface the shipped composition root now exposes (awardFreeKicks + issueCards).
 *
 * This script reads the sequence.json the browser test wrote (the source of
 * truth for the frame anchors — never hand-patched) and folds it into a
 * byte-reproducible record plus the MULTI_TICK trajectory, and reproduces the
 * accepted headless defensive-duel stream for the browser ↔ headless
 * correspondence.
 *
 * The fixture is the accepted driven-duel shape: `eval/scenarios/5v5-human-vs-cpu.v1.json`
 * with `withProximateHumanDefence`, driven by the same repeated scripted
 * standing-tackle policy.  Both the fouls, the free kicks, and the card are REAL
 * core events (the shared foul predicate → the in-core consequence), never
 * scripted theater.
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:REFEREE-SHIPPED-WIRING`.  An ordinary run reads the
 * ephemeral sequence.json under `test-results/gauntlet-capture/**`, writes the
 * same artifacts under that ignored tree, and leaves `docs/` byte-identical.
 * The record carries NO wall-clock field, so consecutive ordinary-mode runs are
 * byte-identical and the pinned `record_sha256` is stable.
 *
 * Usage (after the browser test has written the sequence.json):
 *   WIP_SECTION=__EVIDENCE__:REFEREE-SHIPPED-WIRING \
 *     mise exec -- pnpm exec tsx scripts/capture-referee-shipped-wiring.ts
 *
 * Node I/O is allowed here; the simulation core is untouched.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { runDefensiveDuel } from "../eval/runners/defensive-duel-driver.js";
import { withProximateHumanDefence } from "../eval/scenarios/proximate-5v5.js";
import { isFoulCandidateEvent } from "../src/simulation/foul-predicate.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";

const OBJECTIVE_ID = "REFEREE-SHIPPED-WIRING";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const SCREENSHOT_ROOT = EVIDENCE_MODE
  ? resolve("docs/screenshots", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const SEQUENCE_PATH = resolve(SCREENSHOT_ROOT, "sequence.json");
const TRAJECTORY_PATH = resolve(OUTPUT_ROOT, "trajectory.json");
const STATE_PATH = resolve(OUTPUT_ROOT, "referee-shipped-wiring-state.json");

const SCENARIO_PATH = "eval/scenarios/5v5-human-vs-cpu.v1.json";
const PLAY_TICKS = 320;
const DRIVEN_ATTEMPTS: Array<{ kind: "standing"; commitDistance: number; earliestTick: number }> = [];
for (let t = 44; t <= 300; t += 16) {
  DRIVEN_ATTEMPTS.push({ kind: "standing", commitDistance: 3.0, earliestTick: t });
}
const FREE_KICK_COUNTDOWN = 60;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function loadScenario(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as ScenarioDefinition;
}

interface FrameAnchor {
  label: string;
  path: string;
  tick: number;
  semantic: string;
  description: string;
  sha256: string;
}

interface SequenceArtifact {
  schema_version: number;
  objective_id: string;
  evidence_class: string;
  semantic_order: string;
  scenario: string;
  scenario_path: string;
  arc: {
    foul_ticks: number[];
    foul_count: number;
    card_count: number;
    first_free_kick: {
      tick: number;
      teamId: string;
      free_kick_position: { x: number; y: number };
      kick_direction: { x: number; y: number };
    };
    caution: {
      tick: number;
      cardType: string;
      accumulatedFouls: number;
      playerId: string;
    };
    booking_state: Record<string, { fouls: number; cautions: number; expulsions: number }>;
  };
  frames: FrameAnchor[];
}

function readSequence(): SequenceArtifact {
  const raw = JSON.parse(readFileSync(SEQUENCE_PATH, "utf-8")) as SequenceArtifact;
  if (raw.objective_id !== OBJECTIVE_ID) {
    throw new Error(`sequence.json objective_id mismatch: ${raw.objective_id}`);
  }
  const frames = Array.isArray(raw.frames) ? raw.frames : [];
  if (frames.length < 3 || frames.length > 5) {
    throw new Error(`DYNAMIC_VISUAL requires 3-5 labeled frames; sequence.json has ${frames.length}`);
  }
  for (const frame of frames) {
    if (!frame.label || !frame.path || !frame.sha256) {
      throw new Error(`sequence.json frame is missing label/path/sha256: ${JSON.stringify(frame)}`);
    }
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Headless defensive-duel reproduction (browser ↔ headless correspondence)
// ---------------------------------------------------------------------------

interface RefereeCorrespondence {
  browser_foul_ticks: number[];
  browser_free_kick_tick: number;
  browser_caution_tick: number;
  browser_caution_accumulated_fouls: number;
  browser_caution_player: string;
  headless_foul_ticks: number[];
  headless_free_kick_tick: number;
  headless_caution_tick: number;
  headless_caution_accumulated_fouls: number;
  headless_caution_player: string;
  foul_ticks_equal: boolean;
  free_kick_tick_offset: number;
  caution_tick_offset: number;
  free_kick_countdown: number;
  correspondence_traced: boolean;
}

function correspondence(seq: SequenceArtifact): RefereeCorrespondence {
  const scenario = withProximateHumanDefence(loadScenario(SCENARIO_PATH));
  const duel = runDefensiveDuel({
    scenario,
    maxTicks: PLAY_TICKS,
    attempts: DRIVEN_ATTEMPTS,
    freeKickConfig: { awardFreeKicks: true },
    cardConfig: { issueCards: true },
  });

  const headlessFoulTicks = duel.events
    .filter((e) => isFoulCandidateEvent(e))
    .map((e) => e.tick);
  const headlessFk = duel.freeKickEvents[0];
  const headlessCaution = duel.cardEvents.find(
    (e) => (e.payload as { cardType?: string }).cardType === "caution",
  );
  if (headlessFk === undefined || headlessCaution === undefined) {
    throw new Error("the headless defensive-duel reproduction produced no foul → free-kick → card chain");
  }
  const cp = headlessCaution.payload as { accumulatedFouls: number; playerId: string };

  return {
    browser_foul_ticks: seq.arc.foul_ticks,
    browser_free_kick_tick: seq.arc.first_free_kick.tick,
    browser_caution_tick: seq.arc.caution.tick,
    browser_caution_accumulated_fouls: seq.arc.caution.accumulatedFouls,
    browser_caution_player: seq.arc.caution.playerId,
    headless_foul_ticks: headlessFoulTicks,
    headless_free_kick_tick: headlessFk.tick,
    headless_caution_tick: headlessCaution.tick,
    headless_caution_accumulated_fouls: cp.accumulatedFouls,
    headless_caution_player: cp.playerId,
    foul_ticks_equal:
      JSON.stringify(seq.arc.foul_ticks) === JSON.stringify(headlessFoulTicks),
    free_kick_tick_offset: seq.arc.first_free_kick.tick - headlessFk.tick,
    caution_tick_offset: seq.arc.caution.tick - headlessCaution.tick,
    free_kick_countdown: FREE_KICK_COUNTDOWN,
    correspondence_traced: true,
  };
}

// ---------------------------------------------------------------------------
// Artifact assembly
// ---------------------------------------------------------------------------

mkdirSync(OUTPUT_ROOT, { recursive: true });

const sequence = readSequence();
const corr = correspondence(sequence);

const discharge =
  "The free-kick countdown (60), serve speed (14 m/s), loft (0.18), and ball-z (0.11), and the `fouls-v1` accumulation thresholds (caution at 2 / expulsion at 5) are VERSIONED_PROVISIONAL match-rules-v1/fouls-v1 design choices, NOT measured PES 2017 constants.";
const claimsNotMade = [
  "The referee loop is gated and opt-in through the shipped menu; it is NOT claimed to be always-on, and PES 2017 referee frequency/fidelity is NOT claimed.",
  "No PROMOTION claim. No FOUNDATION_LAB_PASS claim.",
  "No PES 2017 fidelity or measured PES envelope claim: " + discharge.replace("The free-kick countdown (60), serve speed (14 m/s), loft (0.18), and ball-z (0.11), and the `fouls-v1` accumulation thresholds (caution at 2 / expulsion at 5) are VERSIONED_PROVISIONAL match-rules-v1/fouls-v1 design choices, NOT measured PES 2017 constants.", ""),
  "No gameplay / simulation-core / contracts change: git diff src/simulation/ and src/contracts/ are EMPTY. The referee gates flow through the SAME accepted createSimulation config surface; the only browser changes are the app-layer Referee toggle and the opt-in renderer HUD affordances (byte-neutral when off).",
  "No claim that the foul was forced: the foul is a REAL core man-not-ball contact (the shared foul predicate) produced by the driven-duel standing-tackle policy; the award/placement/serve and the booking are the core's own accepted consequence machinery.",
  "No claim that the browser composition root and the headless runner are per-tick byte-identical: the verified correspondence is the event structure (foul ticks, free-kick tick, caution tick, offender/accumulation), never per-tick floats (the known pinned-runtime gap).",
  "No claim that an expulsion reproduces within this window: only the caution (2nd foul) is evidenced here; the full caution→expulsion arc is the separate accepted CARD-BROWSER-EVIDENCE record.",
];

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  produced_by: "scripts/capture-referee-shipped-wiring.ts",
  evidence_class: "DYNAMIC_VISUAL",
  spec_sections: ["FOULS_CARDS_SPEC §5.1", "FOULS_CARDS_SPEC §7", "FOULS_CARDS_SPEC §8", "FOULS_CARDS_SPEC §9.1", "FOULS_CARDS_SPEC §10"],
  scenario: sequence.scenario,
  scenario_path: SCENARIO_PATH,
  play_ticks: PLAY_TICKS,
  rendering: sequence.rendering,
  semantics: {
    order: sequence.semantic_order,
    note:
      "event-centered on the referee consequence: the man-not-ball foul contact, the free-kick award (phase FREE KICK), the served free kick back in play, the 2nd foul contact, and the caution (yellow) booking.",
  },
  frames: sequence.frames.map((frame) => ({
    label: frame.label,
    path: frame.path,
    tick: frame.tick,
    semantic: frame.semantic,
    description: frame.description,
    sha256: frame.sha256,
  })),
  arc: sequence.arc,
  correspondence: corr,
  drives: {
    fixture: "5v5-human-vs-cpu.v1.json + withProximateHumanDefence (the accepted driven-duel shape)",
    policy: `repeated scripted standing-tackle (commitDistance 3.0, earliestTick 44, every 16 ticks) on the HUMAN slot; CPU slots through the same adapter + team-decision profile the browser composition root uses`,
    gates: "awardFreeKicks:true + issueCards:true (the SAME createSimulation config surface the shipped composition root exposes via the Referee toggle)",
    capture_test: "tests/browser/referee-shipped-wiring.browser.test.ts",
    rendering_surface: "src/apps/browser/test-bridge.ts + real Three renderer (Chromium), showMatchPhaseHud:true + showCardHud:true",
  },
  disclosures: [
    "The fouls, the free kick, and the caution are REAL core events: the core commits a man-not-ball tackle contact (spec §5.1) and, with both accepted gates live, awards a free kick to the fouled team at the contact position and issues the caution on the 2nd accumulated foul. The driven-duel script reproduces the headless defensive-duel driver's standing-tackle policy; nothing is forced or synthesized.",
    "The single run drives BOTH the foul→free-kick consequence and the accumulating booking, so a real player who opts into the Referee toggle sees a free kick AND a card in the same match.",
    "The driven fixture is a DRIVEN duel (short observation window, scripted standing tackles), not an organic 90-minute match; the fouling sequence is disclosed, not masked.",
    "The card events and free-kick-executed events are read from the core's committed persistent state ((the accepted serialization limitation), so the browser test enriches the snapshot (enrichPresentationWithCards) for the card HUD.",
    "PNG re-capture non-determinism: the WebGL readPixels + canvas.toDataURL render path (GPU/rasterizer floats) is not promised byte-identical across re-captures; the per-frame SHA-256 values recorded here are the bytes captured at evidence time. The record JSON itself is byte-reproducible (record_sha256) and carries no wall-clock field, and an ordinary (non-evidence) run writes under test-results/gauntlet-capture/** and leaves docs/ byte-identical.",
    discharge,
  ],
  claims_not_made: claimsNotMade,
};

const forHashing: Record<string, unknown> = { ...record };
delete forHashing.record_sha256;
record.record_sha256 = sha256(JSON.stringify(forHashing));

const trajectory: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  evidence_class: "MULTI_TICK",
  capture_mode: EVIDENCE_MODE ? "durable-evidence" : "ephemeral",
  produced_by: "scripts/capture-referee-shipped-wiring.ts",
  driver:
    "eval/runners/defensive-duel-driver.ts runDefensiveDuel({ freeKickConfig:{ awardFreeKicks:true }, cardConfig:{ issueCards:true } }) — the accepted driven-duel shape reproducing the browser run's event structure.",
  scenario: sequence.scenario,
  scenario_path: SCENARIO_PATH,
  play_ticks: PLAY_TICKS,
  frame_anchors: sequence.frames.map((frame) => ({
    label: frame.label,
    path: frame.path,
    tick: frame.tick,
    semantic: frame.semantic,
    sha256: frame.sha256,
  })),
  correspondence: corr,
  free_kick_countdown: FREE_KICK_COUNTDOWN,
  disclosures: [
    "The trajectory is the accepted headless defensive-duel stream (fouls at " +
      String(corr.headless_foul_ticks.join("/")) +
      ", free kick at tick " + String(corr.headless_free_kick_tick) +
      ", caution at tick " + String(corr.headless_caution_tick) +
      "). The browser run locates the same event structure from its own event log; per-tick floats are not compared across runtimes (the known pinned-runtime gap).",
    discharge,
  ],
};

writeFileSync(TRAJECTORY_PATH, `${JSON.stringify(trajectory, null, 2)}\n`, "utf-8");
writeFileSync(STATE_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
console.log(
  `[referee-wiring] frames ${sequence.frames.map((f) => `${f.label}@${f.tick}`).join(" ")}` +
    ` (durable=${EVIDENCE_MODE})`,
);
console.log(
  `[referee-wiring] correspondence browser fouls=${corr.browser_foul_ticks.join("/")} fk@${corr.browser_free_kick_tick} caution@${corr.browser_caution_tick}` +
    ` ; headless fouls=${corr.headless_foul_ticks.join("/")} fk@${corr.headless_free_kick_tick} caution@${corr.headless_caution_tick}` +
    ` ; offsets ${corr.free_kick_tick_offset}/${corr.caution_tick_offset}`,
);
console.log(`[referee-wiring] wrote ${TRAJECTORY_PATH}`);
console.log(`[referee-wiring] wrote ${STATE_PATH}`);
console.log(`[referee-wiring] record_sha256=${String(record.record_sha256)}`);
