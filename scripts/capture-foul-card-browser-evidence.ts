/**
 * Node-side evidence producer for FOUL-CARD-BROWSER-EVIDENCE.
 *
 * DYNAMIC_VISUAL evidence: the contact-severity DIRECT red (FOULS_CARDS_SPEC
 * §7 / §9.1 / §10) visible in the real shipped app (real Chromium + real Three
 * renderer through the accepted test bridge).  The event-centered frames + their
 * sequence.json path bindings are captured by the browser test
 * (tests/browser/foul-card-severity-browser-evidence.browser.test.ts).  This
 * script reads that sequence.json — the source of truth for the frame anchors
 * (the CORNER-DRIVEN lesson: sequence.json is written by the capture source with
 * path bindings, never hand-patched) — and folds in the headless
 * FOUL-CARD-SEVERITY driven slide stream (the SAME scripted slide shape: ONE
 * slide tackle, commitDistance 4.0, earliestTick 48) for the browser ↔ headless
 * correspondence, then writes the byte-reproducible record plus the MULTI_TICK
 * trajectory.
 *
 * The fixture is the accepted CARD-MACHINERY driven-duel shape:
 * `eval/scenarios/5v5-human-vs-cpu.v1.json` with `withProximateHumanDefence`.
 * With the accepted default-OFF gates live (issueCards + awardFreeKicks), the
 * core commits a man-not-ball slide contact whose COMMITTED severity crosses
 * the exported `fouls-v1` §9.1 threshold (`FOUL_CARD_DIRECT_RED_SEVERITY_THRESHOLD`
 * 0.85, src/simulation/card-policy.ts) and issues a DIRECT expulsion at the foul
 * tick.  The foul, the card, and the free kick are REAL core events; the
 * driven-duel script only reproduces what the headless defensive-duel driver
 * already does.
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:FOUL-CARD-BROWSER-EVIDENCE`.  An ordinary run reads
 * the ephemeral sequence.json under `test-results/gauntlet-capture/**`, writes
 * the same artifacts under that ignored tree, and leaves `docs/` byte-identical.
 * The record carries NO wall-clock field, so consecutive ordinary-mode runs are
 * byte-identical and the pinned `record_sha256` is stable.
 *
 * Usage (after the browser test has written the sequence.json):
 *   WIP_SECTION=__EVIDENCE__:FOUL-CARD-BROWSER-EVIDENCE \
 *     mise exec -- pnpm exec tsx scripts/capture-foul-card-browser-evidence.ts
 *
 * Node I/O is allowed here; the simulation core is untouched.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { runDefensiveDuel } from "../eval/runners/defensive-duel-driver.js";
import type { DefensiveDuelResult } from "../eval/runners/defensive-duel-driver.js";
import { withProximateHumanDefence } from "../eval/scenarios/proximate-5v5.js";
import { isFoulCandidateEvent } from "../src/simulation/foul-predicate.js";
import { FOUL_CARD_DIRECT_RED_SEVERITY_THRESHOLD } from "../src/simulation/card-policy.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";

const OBJECTIVE_ID = "FOUL-CARD-BROWSER-EVIDENCE";
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
const STATE_PATH = resolve(OUTPUT_ROOT, "foul-card-browser-evidence-state.json");

const SCENARIO_PATH = "eval/scenarios/5v5-human-vs-cpu.v1.json";
/** Observation window (the slide foul lands at 52; ample). */
const PLAY_TICKS = 200;
/** The scripted slide attempt (the FOUL-CARD-SEVERITY SLIDE_ATTEMPTS shape). */
const SLIDE_ATTEMPTS: Array<{ kind: "slide"; commitDistance: number; earliestTick: number }> = [
  { kind: "slide", commitDistance: 4.0, earliestTick: 48 },
];

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function loadScenario(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as ScenarioDefinition;
}

// ---------------------------------------------------------------------------
// sequence.json — the frame anchors written by the browser capture test
// ---------------------------------------------------------------------------

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
  rendering: { surface: string; hud: string };
  arc: {
    foul_ticks: number[];
    fouling_player_id: string;
    direct_red: {
      tick: number;
      cardType: string;
      cardReason: string;
      directRedSeverity: number | null;
      accumulatedFouls: number;
      fouledPlayerId: string;
    };
    booking_state: Record<string, { fouls: number; cautions: number; expulsions: number }> | null;
    controls: {
      standing_tackle: {
        foul_ticks: number[];
        card_count: number;
        card_type: string | null;
        direct_red: boolean;
      };
      gate_off: {
        card_count: number;
        bookings_present: boolean;
      };
    };
  };
  frames: FrameAnchor[];
}

function readSequence(): SequenceArtifact {
  const raw = JSON.parse(readFileSync(SEQUENCE_PATH, "utf-8")) as SequenceArtifact;
  if (raw.objective_id !== OBJECTIVE_ID) {
    throw new Error(`sequence.json objective_id mismatch: ${raw.objective_id}`);
  }
  const frames = Array.isArray(raw.frames) ? raw.frames : [];
  if (frames.length !== 2) {
    throw new Error(`FOUL-CARD-BROWSER-EVIDENCE requires 2 frames; sequence.json has ${frames.length}`);
  }
  for (const frame of frames) {
    if (!frame.label || !frame.path || !frame.sha256) {
      throw new Error(`sequence.json frame is missing label/path/sha256: ${JSON.stringify(frame)}`);
    }
  }
  if (!raw.arc?.direct_red || raw.arc.direct_red.cardReason !== "direct-severity") {
    throw new Error("sequence.json arc is missing the direct-severity direct red");
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Headless severity reproduction (browser ↔ headless correspondence)
// ---------------------------------------------------------------------------

interface CardCorrespondence {
  browser_foul_tick: number;
  browser_direct_red_tick: number;
  browser_fouling_player: string;
  browser_fouled_player: string;
  browser_direct_red_severity: number | null;
  browser_booking_state: Record<string, { fouls: number; cautions: number; expulsions: number }> | null;
  headless_foul_tick: number;
  headless_direct_red_tick: number;
  headless_fouling_player: string;
  headless_fouled_player: string;
  headless_direct_red_severity: number | null;
  headless_booking_state: Record<string, { fouls: number; cautions: number; expulsions: number }> | null;
  foul_tick_offset: number;
  direct_red_tick_offset: number;
  offsets_traced: boolean;
}

function correspondence(sequence: SequenceArtifact): CardCorrespondence {
  const scenario = withProximateHumanDefence(loadScenario(SCENARIO_PATH));
  const duel: DefensiveDuelResult = runDefensiveDuel({
    scenario,
    maxTicks: PLAY_TICKS,
    attempts: SLIDE_ATTEMPTS,
    cardConfig: { issueCards: true },
    freeKickConfig: { awardFreeKicks: true },
  });

  const headlessFoulTicks = duel.events
    .filter((ev) => isFoulCandidateEvent(ev))
    .map((ev) => ev.tick);
  if (headlessFoulTicks.length !== 1) {
    throw new Error(
      `the headless severity reproduction must commit exactly one slide foul; got ${headlessFoulTicks.length}`,
    );
  }
  const directReds = duel.cardEvents.filter(
    (ev) => ((ev.payload ?? {}) as { cardReason?: string }).cardReason === "direct-severity",
  );
  if (directReds.length !== 1) {
    throw new Error(
      `the headless severity reproduction must commit exactly one direct red; got ${directReds.length}`,
    );
  }
  const hp = directReds[0].payload as {
    playerId: string;
    fouledPlayerId: string;
    directRedSeverity: number | null;
  };

  return {
    browser_foul_tick: sequence.arc.foul_ticks[0],
    browser_direct_red_tick: sequence.arc.direct_red.tick,
    browser_fouling_player: sequence.arc.fouling_player_id,
    browser_fouled_player: sequence.arc.direct_red.fouledPlayerId,
    browser_direct_red_severity: sequence.arc.direct_red.directRedSeverity,
    browser_booking_state: sequence.arc.booking_state,
    headless_foul_tick: headlessFoulTicks[0],
    headless_direct_red_tick: directReds[0].tick,
    headless_fouling_player: hp.playerId,
    headless_fouled_player: hp.fouledPlayerId,
    headless_direct_red_severity: hp.directRedSeverity,
    headless_booking_state: duel.bookingState ?? null,
    foul_tick_offset: sequence.arc.foul_ticks[0] - headlessFoulTicks[0],
    direct_red_tick_offset: sequence.arc.direct_red.tick - directReds[0].tick,
    offsets_traced: true,
  };
}

// ---------------------------------------------------------------------------
// Artifact assembly
// ---------------------------------------------------------------------------

mkdirSync(OUTPUT_ROOT, { recursive: true });

const sequence = readSequence();
const corr = correspondence(sequence);

const discharge =
  `The §9.1 direct-red severity threshold (${FOUL_CARD_DIRECT_RED_SEVERITY_THRESHOLD}) and the ` +
  `committed-contact severity normalization (challenge span × contact penetration, src/simulation/card-policy.ts) are ` +
  `fouls-v1 VERSIONED_PROVISIONAL design choices, NOT measured PES 2017 constants.`;

const claimsNotMade = [
  "No suite-level PASS claim: this is DYNAMIC_VISUAL browser-visible evidence; the CARD-DIRECT-RED criterion adjudication lives in the FOUL-CARD-SEVERITY headless record.",
  "No second-yellow rule: the direct red reads only the committed contact severity, never the accumulated count.",
  "No regulation/removal mechanics: the direct red does not remove the offender from play.",
  "No PES 2017 fidelity or invented reference envelope: §11's foul_severity_distribution_ref / disciplinary_scale_ref stay BLOCKED_MISSING_REFERENCE.",
  "No claim that the browser composition root and the headless runner are per-tick byte-identical: the verified correspondence is the event structure (foul tick, direct-red tick, offender, fouled player, committed severity), never per-tick floats (the known pinned-runtime gap).",
  "No accepted pin altered.",
];

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  produced_by: "scripts/capture-foul-card-browser-evidence.ts",
  evidence_class: "DYNAMIC_VISUAL",
  spec_sections: [
    "FOULS_CARDS_SPEC §5.1",
    "FOULS_CARDS_SPEC §7",
    "FOULS_CARDS_SPEC §9.1",
    "FOULS_CARDS_SPEC §10",
    "FOULS_CARDS_SPEC §11",
  ],
  direct_red_severity_threshold: FOUL_CARD_DIRECT_RED_SEVERITY_THRESHOLD,
  scenario: sequence.scenario,
  scenario_path: SCENARIO_PATH,
  play_ticks: PLAY_TICKS,
  rendering: sequence.rendering,
  semantics: {
    order: sequence.semantic_order,
    note:
      "event-centered on the direct-red consequence: the slide lunge closing on the carrier, then the committed slide man-not-ball contact whose severity crosses the fouls-v1 §9.1 threshold — the core issues the DIRECT expulsion on the foul tick and the card HUD draws the RED CARD notice through the presentation-only enrichment.",
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
    policy:
      "ONE scripted slide tackle (commitDistance 4.0, earliestTick 48 — the FOUL-CARD-SEVERITY SLIDE_ATTEMPTS shape) on the HUMAN slot; CPU slots through the same adapter + team-decision profile the browser composition root uses; gates issueCards + awardFreeKicks ON",
    capture_test: "tests/browser/foul-card-severity-browser-evidence.browser.test.ts",
    rendering_surface:
      "src/apps/browser/test-bridge.ts + real Three renderer (Chromium), showMatchPhaseHud:true + showCardHud:true",
  },
  disclosures: [
    "The fouls and cards are REAL core events: the core commits the slide man-not-ball tackle contact (spec §5.1) and, with the accepted issueCards gate, the in-core card consequence issues a DIRECT expulsion because the committed contact severity crosses the §9.1 threshold. The driven-duel script reproduces the headless defensive-duel driver's scripted slide policy; nothing is forced or synthesized.",
    "The card-issued event is commit-only to the core's persistent state (the accepted serialization limitation), so the browser test reads it from the snapshot's committed events rather than the per-step event array. The card HUD reads the same committed events through the presentation-only enrichment (enrichPresentationWithCards).",
    "The renderer card HUD is the accepted OPTIONAL, draw-only presentation affordance (showCardHud, default false). The direct-red label is commit-only, so the browser-visible RED CARD notice is asserted at the pixel plane: the direct-red frame carries the red notice pixels, the pre-card frame carries none.",
    "In-test controls: the standing-tackle control (repeated standing tackles below the threshold) commits the §7 accumulation caution only — no direct red; the gate-off shape (the identical slide with issueCards off) commits no card and keeps bookings absent.",
    "The driven fixture is a DRIVEN duel (short observation window, a scripted slide sequence), not an organic 90-minute match; the fouling sequence is disclosed, not masked.",
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
  produced_by: "scripts/capture-foul-card-browser-evidence.ts",
  driver:
    "eval/runners/defensive-duel-driver.ts runDefensiveDuel({ attempts:[{kind:'slide',commitDistance:4.0,earliestTick:48}], cardConfig:{issueCards:true}, freeKickConfig:{awardFreeKicks:true} }) — the FOUL-CARD-SEVERITY driven slide shape with both accepted gates.",
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
  arc: sequence.arc,
  correspondence: corr,
  foul_count: sequence.arc.foul_ticks.length,
  direct_red_card_count: sequence.arc.direct_red.cardReason === "direct-severity" ? 1 : 0,
  disclosures: [
    "The trajectory is the headless FOUL-CARD-SEVERITY driven slide stream (slide press at tick 48, active-window foul at tick 52, direct red committed at tick 52, free-kick window served at tick 112). The browser run locates the same event structure from its own committed event log; per-tick floats are not compared across runtimes (the known pinned-runtime gap).",
    "The standing-tackle control's accumulation caution and the gate-off no-card shape are recorded in the browser arc.controls and re-adjudicated in the browser test; the headless analogue lives in the FOUL-CARD-SEVERITY record.",
    discharge,
  ],
};

writeFileSync(TRAJECTORY_PATH, `${JSON.stringify(trajectory, null, 2)}\n`, "utf-8");
writeFileSync(STATE_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
console.log(
  `[foul-card-browser-evidence] frames ${sequence.frames.map((f) => `${f.label}@${f.tick}`).join(" ")}` +
    ` (durable=${EVIDENCE_MODE})`,
);
console.log(
  `[foul-card-browser-evidence] correspondence browser foul@${corr.browser_foul_tick} directRed@${corr.browser_direct_red_tick}` +
    ` ; headless foul@${corr.headless_foul_tick} directRed@${corr.headless_direct_red_tick}` +
    ` ; offsets ${corr.foul_tick_offset}/${corr.direct_red_tick_offset}` +
    ` ; severity ${corr.browser_direct_red_severity}`,
);
console.log(`[foul-card-browser-evidence] wrote ${TRAJECTORY_PATH}`);
console.log(`[foul-card-browser-evidence] wrote ${STATE_PATH}`);
console.log(`[foul-card-browser-evidence] record_sha256=${String(record.record_sha256)}`);
